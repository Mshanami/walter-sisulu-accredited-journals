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
  for (const msg of [...messages].reverse()) {
    const text = (msg.content || '').toLowerCase()
    for (const [name, aliases] of Object.entries(CAMPUSES)) {
      if (aliases.some(a => text.includes(a))) return name
    }
  }
  return null
}

// Check if the last assistant message was asking for a campus
function agentAskedForCampus(messages) {
  const assistantMsgs = messages.filter(m => m.role === 'assistant')
  if (assistantMsgs.length === 0) return false
  const last = (assistantMsgs[assistantMsgs.length - 1].content || '').toLowerCase()
  return last.includes('which iws campus') || last.includes('which campus') || last.includes('campus are you at')
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
  const allMsgs = Array.isArray(input) ? [...input] : [{ role: 'user', content: input }]
  const campus = detectCampus(allMsgs)

  if (campus) {
    const justAnsweredCampus = agentAskedForCampus(allMsgs)
    const originalQ = allMsgs.filter(m => m.role === 'user').slice(-2, -1)[0]?.content || 'library services at this campus'

    const injectionContent = justAnsweredCampus
      ? `CONTEXT: The user just confirmed their campus is ${campus} in response to your question. ` +
        `Do NOT ask any follow-up. Do NOT ask for clarification. ` +
        `Their original question was: "${originalQ}". ` +
        `Answer that question now, directly, for the ${campus} campus.`
      : `CONTEXT: The user is at the ${campus} campus. ` +
        `Do NOT ask for their campus again. Answer their question directly for ${campus} campus.`

    const lastUserIdx = allMsgs.map(m => m.role).lastIndexOf('user')
    allMsgs.splice(lastUserIdx, 0, { role: 'system', content: injectionContent })
    input = allMsgs
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
