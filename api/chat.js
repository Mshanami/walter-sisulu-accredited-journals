// api/chat.js — Vercel Serverless Function
// Set AZURE_AI_API_KEY in Vercel → Settings → Environment Variables

const AZURE_ENDPOINT =
  'https://bmngomezulu-5709-resource.services.ai.azure.com/api/projects/bmngomezulu-5709/applications/LibraryAssistant/protocols/openai/responses?api-version=2025-11-15-preview'

export const config = { api: { bodyParser: { sizeLimit: '15mb' } } }

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

  // Normalise file content and strip base64 from older messages to keep payload small
  if (Array.isArray(input)) {
    const lastFileIdx = input.reduce((last, m, i) => {
      if (Array.isArray(m.content) && m.content.some(c => c.type === 'input_file' || c.type === 'image_url')) return i
      return last
    }, -1)

    input = input.map((m, i) => {
      if (!Array.isArray(m.content)) return m

      // Replace old file messages with a placeholder text
      if (i < lastFileIdx) {
        return {
          ...m,
          content: m.content.map(c => {
            if (c.type === 'input_file' || c.type === 'image_url') {
              const name = c.filename || c.image_url?.url?.slice(0,30) || 'file'
              return { type: 'input_text', text: `[Previously uploaded file: ${name}]` }
            }
            return c
          })
        }
      }

      // Normalise the current file message to Azure Foundry format
      return {
        ...m,
        content: m.content.map(c => {
          if (c.type === 'input_file') {
            const isImage = c.file_data?.startsWith('data:image')
            if (isImage) {
              // Images: use image_url format
              return { type: 'image_url', image_url: { url: c.file_data } }
            } else {
              // PDFs: Azure Foundry Responses API doesn't support PDF binary directly
              // Send as a note and ask agent to acknowledge
              return { type: 'input_text', text: `[User attached a PDF file named "${c.filename}". Acknowledge the upload and let them know you can help with questions about it, but you cannot read PDF content directly. Suggest they copy and paste the relevant text.]` }
            }
          }
          return c
        })
      }
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
