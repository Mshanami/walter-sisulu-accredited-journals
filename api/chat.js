// api/chat.js — Vercel Serverless Function
// Azure AI Projects Agent (new format with session management)
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

function getHeaders(apiKey) {
  return { 'Content-Type': 'application/json', 'api-key': apiKey }
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

  // Campus context injection
  const campus = detectCampus(msgs)
  if (campus) {
    const lastUserIdx = msgs.map(m => m.role).lastIndexOf('user')
    if (lastUserIdx !== -1) {
      const justAnsweredCampus = agentAskedForCampus(msgs)
      const originalQ = msgs.filter(m => m.role === 'user').slice(-2, -1)[0]?.content || 'library services'
      const prefix = justAnsweredCampus
        ? `[Campus: ${campus}. Original question: "${originalQ}". Answer it now for ${campus} campus. Do not ask anything else.] `
        : `[Campus: ${campus}. Answer directly for ${campus} campus. Do not ask for campus again.] `
      const c = msgs[lastUserIdx].content
      msgs[lastUserIdx].content = prefix + (typeof c === 'string' ? c : JSON.stringify(c))
    }
  }

  // Strip old file base64 from history
  const lastFileIdx = msgs.reduce((last, m, i) =>
    Array.isArray(m.content) && m.content.some(c => c.type === 'input_file' || c.type === 'image_url') ? i : last, -1)
  const cleanMsgs = msgs.map((m, i) => {
    if (i < lastFileIdx && Array.isArray(m.content)) {
      return { ...m, content: m.content.map(c =>
        (c.type === 'input_file' || c.type === 'image_url')
          ? { type: 'input_text', text: `[Previously uploaded: ${c.filename || 'file'}]` }
          : c
      )}
    }
    if (Array.isArray(m.content)) {
      return { ...m, content: m.content.map(c =>
        c.type === 'input_file'
          ? (c.file_data?.startsWith('data:image')
              ? { type: 'image_url', image_url: { url: c.file_data } }
              : { type: 'input_text', text: `[User uploaded PDF: "${c.filename}". Acknowledge and suggest they paste relevant text.]` })
          : c
      )}
    }
    return m
  })

  // Extract just the last user message as a plain string for the agent
  // (agent manages its own conversation state via sessions)
  const lastUser = [...cleanMsgs].reverse().find(m => m.role === 'user')
  const userInput = typeof lastUser?.content === 'string'
    ? lastUser.content
    : Array.isArray(lastUser?.content)
      ? lastUser.content.filter(c => c.type === 'input_text').map(c => c.text).join('\n')
      : 'Hello'

  try {
    // Step 1: Create a session
    const sessionRes = await fetch(
      `${PROJECT_ENDPOINT}/agents/${AGENT_NAME}/sessions?api-version=${API_VERSION}`,
      {
        method: 'POST',
        headers: getHeaders(apiKey),
        body: JSON.stringify({ isolation_key: 'iws-libai-web' })
      }
    )

    let sessionId = null
    if (sessionRes.ok) {
      const sessionData = await sessionRes.json()
      sessionId = sessionData.agent_session_id || sessionData.id || null
    }

    // Step 2: Call the Responses API
    const responseBody = { input: userInput }
    if (sessionId) responseBody.agent_session_id = sessionId

    const agentRes = await fetch(
      `${PROJECT_ENDPOINT}/agents/${AGENT_NAME}/openai/responses?api-version=${API_VERSION}`,
      {
        method: 'POST',
        headers: getHeaders(apiKey),
        body: JSON.stringify(responseBody)
      }
    )

    const text = await agentRes.text()
    let data
    try { data = JSON.parse(text) } catch { data = { raw: text } }

    // Clean up session (fire and forget)
    if (sessionId) {
      fetch(
        `${PROJECT_ENDPOINT}/agents/${AGENT_NAME}/sessions/${sessionId}?isolation_key=iws-libai-web&api-version=${API_VERSION}`,
        { method: 'DELETE', headers: getHeaders(apiKey) }
      ).catch(() => {})
    }

    return res.status(agentRes.status).json(data)

  } catch (err) {
    console.error('Proxy error:', err)
    return res.status(502).json({ error: 'Failed to reach Azure AI agent.', detail: err.message })
  }
}
