// api/chat.js — Vercel Serverless Function
// Handles campus detection in code so the agent never asks twice.
// Set AZURE_AI_API_KEY in Vercel → Settings → Environment Variables

const AZURE_ENDPOINT =
  'https://bmngomezulu-7756-resource.services.ai.azure.com/api/projects/bmngomezulu-7756/applications/LibraryAssistant/protocols/openai/responses?api-version=2025-11-15-preview'

export const config = { api: { bodyParser: true } }

// Campus names and their aliases the user might type
const CAMPUSES = {
  'Buffalo City': ['buffalo city', 'east london', 'buffalo', 'ecl', 'bcm'],
  'Mthatha':      ['mthatha', 'umtata', 'mth'],
  'Butterworth':  ['butterworth', 'butter'],
  'Komani':       ['komani', 'queenstown', 'queen'],
  'Potsdam':      ['potsdam'],
  'Chiselhurst':  ['chiselhurst', 'chisel'],
}

// Detect campus from any message in the history
function detectCampus(messages) {
  for (const msg of messages) {
    const text = (msg.content || '').toLowerCase()
    for (const [name, aliases] of Object.entries(CAMPUSES)) {
      if (aliases.some(a => text.includes(a))) return name
    }
  }
  return null
}

// Build a context injection message so the agent always knows the campus
function buildCampusInjection(campus) {
  return {
    role: 'system',
    content: `CONTEXT: The user has confirmed they are at the ${campus} campus. ` +
      `You already know their campus. Do NOT ask for it again. ` +
      `Answer their current question directly for the ${campus} campus.`
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.AZURE_AI_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'AZURE_AI_API_KEY is not set in environment variables.' })
  }

  let body = req.body
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch { body = {} }
  }

  let { input } = body || {}
  if (!input) {
    return res.status(400).json({ error: 'Missing "input" field in request body.' })
  }

  // Detect campus from conversation history and inject context if found
  const campus = detectCampus(Array.isArray(input) ? input : [{ content: input }])
  if (campus) {
    // Inject campus context as the last system message before the final user message
    const msgs = Array.isArray(input) ? [...input] : [{ role: 'user', content: input }]
    const lastUserIdx = msgs.map(m => m.role).lastIndexOf('user')
    msgs.splice(lastUserIdx, 0, buildCampusInjection(campus))
    input = msgs
  }

  try {
    const upstream = await fetch(AZURE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({ input }),
    })

    const text = await upstream.text()
    let data
    try { data = JSON.parse(text) } catch { data = { raw: text } }

    return res.status(upstream.status).json(data)
  } catch (err) {
    console.error('Proxy error:', err)
    return res.status(502).json({ error: 'Failed to reach Azure AI Foundry.', detail: err.message })
  }
}
