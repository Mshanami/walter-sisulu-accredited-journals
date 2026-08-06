// api/chat.js — Vercel Serverless Function
// Set AZURE_AI_API_KEY in Vercel → Settings → Environment Variables

export const config = { api: { bodyParser: { sizeLimit: '15mb' } } }

const PROJECT_ENDPOINT = 'https://bmngomezulu-5709-resource.services.ai.azure.com/api/projects/bmngomezulu-5709'
const AGENT_NAME       = 'LibraryAssistant'
const API_VERSION      = '2025-11-15-preview'

const CAMPUSES = {
  'Buffalo City': ['buffalo city', 'east london', 'buffalo', 'ecl', 'bcm'],
  'Mthatha':      ['mthatha', 'umtata'],
  'Butterworth':  ['butterworth', 'butter'],
  'Komani':       ['komani', 'queenstown'],
  'Potsdam':      ['potsdam'],
  'Chiselhurst':  ['chiselhurst', 'chisel'],
}

function detectCampus(messages) {
  for (const msg of [...messages].reverse()) {
    const text = (typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content || '')).toLowerCase()
    for (const [name, aliases] of Object.entries(CAMPUSES)) {
      if (aliases.some(a => text.includes(a))) return name
    }
  }
  return null
}

function agentAskedForCampus(messages) {
  const assistantMsgs = messages.filter(m => m.role === 'assistant')
  if (!assistantMsgs.length) return false
  const last = (assistantMsgs[assistantMsgs.length - 1].content || '').toLowerCase()
  return last.includes('which') && last.includes('campus')
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.AZURE_AI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'AZURE_AI_API_KEY is not set.' })

  let body = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }

  let { input } = body || {}
  if (!input) return res.status(400).json({ error: 'Missing "input" field.' })

  const msgs = Array.isArray(input) ? input.map(m => ({ ...m })) : [{ role: 'user', content: String(input) }]

  // Campus context injection onto last user message
  const campus = detectCampus(msgs)
  if (campus) {
    const lastUserIdx = msgs.map(m => m.role).lastIndexOf('user')
    if (lastUserIdx !== -1) {
      const justAnsweredCampus = agentAskedForCampus(msgs)
      const originalQ = msgs.filter(m => m.role === 'user').slice(-2, -1)[0]?.content || 'library services'
      const prefix = justAnsweredCampus
        ? `[Campus: ${campus}. Original question: "${originalQ}". Answer it now for ${campus} campus.] `
        : `[Campus: ${campus}. Answer directly for ${campus} campus. Do not ask for campus again.] `
      const c = msgs[lastUserIdx].content
      msgs[lastUserIdx].content = prefix + (typeof c === 'string' ? c : JSON.stringify(c))
    }
  }

  // Try three endpoint patterns in order until one works
  const endpoints = [
    `${PROJECT_ENDPOINT}/agents/${AGENT_NAME}/openai/responses?api-version=${API_VERSION}`,
    `${PROJECT_ENDPOINT}/applications/${AGENT_NAME}/protocols/openai/responses?api-version=${API_VERSION}`,
    `${PROJECT_ENDPOINT}/openai/responses?api-version=${API_VERSION}`,
  ]

  let lastStatus = 502
  let lastData = {}

  for (const url of endpoints) {
    try {
      const upstream = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
        body: JSON.stringify({ input: msgs }),
      })

      const text = await upstream.text()
      console.log(`ENDPOINT_TRY | ${upstream.status} | ${url} | ${text.slice(0, 200)}`)

      if (!text) { lastStatus = upstream.status; continue }

      let data
      try { data = JSON.parse(text) } catch { data = { raw: text } }

      // If Azure returned a real response (not 404/400), use it
      if (upstream.status !== 404 && upstream.status !== 405) {
        return res.status(upstream.status).json(data)
      }
      lastStatus = upstream.status
      lastData = data
    } catch (err) {
      console.error('Endpoint error:', url, err.message)
    }
  }

  return res.status(lastStatus).json({
    error: 'All endpoint patterns returned 404. Check Vercel logs for ENDPOINT_TRY entries to see Azure responses.',
    last: lastData
  })
}
