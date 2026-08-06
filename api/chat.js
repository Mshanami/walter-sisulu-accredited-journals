// api/chat.js — Vercel Serverless Function
// Set AZURE_AI_API_KEY in Vercel → Settings → Environment Variables

const AZURE_ENDPOINT =
  'https://bmngomezulu-7756-resource.services.ai.azure.com/api/projects/bmngomezulu-7756/applications/LibraryAssistant/protocols/openai/responses?api-version=2025-11-15-preview'

export const config = { api: { bodyParser: true } }

const CAMPUSES = {
  'Buffalo City': ['buffalo city', 'east london', 'buffalo', 'ecl', 'bcm'],
  'Mthatha':      ['mthatha', 'umtata'],
  'Butterworth':  ['butterworth', 'butter'],
  'Komani':       ['komani', 'queenstown'],
  'Potsdam':      ['potsdam'],
  'Chiselhurst':  ['chiselhurst', 'chisel'],
}

function detectCampus(messages) {
  // Scan all messages in reverse to find most recent campus mention
  for (const msg of [...messages].reverse()) {
    const text = (msg.content || '').toLowerCase()
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
  if (!apiKey) {
    return res.status(500).json({ error: 'AZURE_AI_API_KEY is not set.' })
  }

  let body = req.body
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch { body = {} }
  }

  let { input } = body || {}
  if (!input) {
    return res.status(400).json({ error: 'Missing "input" field in request body.' })
  }

  // Work with a copy of the messages array
  const msgs = Array.isArray(input) ? input.map(m => ({ ...m })) : [{ role: 'user', content: String(input) }]

  // Detect campus from full conversation history
  const campus = detectCampus(msgs)

  if (campus) {
    // Find the last user message and prepend campus context to its content
    // This avoids injecting extra messages which break the Azure Foundry format
    const lastUserIdx = msgs.map(m => m.role).lastIndexOf('user')
    if (lastUserIdx !== -1) {
      const originalContent = msgs[lastUserIdx].content || ''
      const justAnsweredCampus = agentAskedForCampus(msgs)

      let prefix
      if (justAnsweredCampus) {
        // User just replied with campus name — retrieve original question
        const userMsgs = msgs.filter(m => m.role === 'user')
        const originalQuestion = userMsgs.length >= 2
          ? userMsgs[userMsgs.length - 2].content
          : 'library services'

        prefix = `[Campus: ${campus}. The user is answering your campus question. ` +
          `Their original question was: "${originalQuestion}". ` +
          `Answer that question now for ${campus} campus. Do not ask anything else.] `
      } else {
        prefix = `[Campus: ${campus}. Answer directly for ${campus} campus. Do not ask for campus again.] `
      }

      msgs[lastUserIdx].content = prefix + originalContent
    }
    input = msgs
  }

  // Trim base64 file data from older messages (keep only the latest) to avoid huge payloads
  if (Array.isArray(input)) {
    const lastFileIdx = input.reduce((last, m, i) => {
      if (Array.isArray(m.content) && m.content.some(c => c.type === 'input_file')) return i
      return last
    }, -1)
    input = input.map((m, i) => {
      if (i < lastFileIdx && Array.isArray(m.content)) {
        return { ...m, content: m.content.map(c => c.type === 'input_file' ? { type: 'input_text', text: `[Previously uploaded file: ${c.filename}]` } : c) }
      }
      return m
    })
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
