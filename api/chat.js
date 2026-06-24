// api/chat.js — Vercel Serverless Function
// Proxies requests to Azure AI Foundry, keeping the API key server-side.
// Set AZURE_AI_API_KEY in Vercel's Environment Variables dashboard.

const AZURE_ENDPOINT =
  'https://bmngomezulu-7756-resource.services.ai.azure.com/api/projects/bmngomezulu-7756/applications/LibraryAssistant/protocols/openai/responses?api-version=2025-11-15-preview'

export const config = { api: { bodyParser: true } }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.AZURE_AI_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'AZURE_AI_API_KEY environment variable is not set.' })
  }

  // Safely parse body — handles both pre-parsed object and raw string
  let body = req.body
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch { body = {} }
  }

  const { input, model } = body || {}
  if (!input) {
    return res.status(400).json({ error: 'Request body must include an "input" field.', received: JSON.stringify(body) })
  }

  try {
    const upstream = await fetch(AZURE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: model || 'gpt-4o', input }),
    })

    const data = await upstream.json()
    return res.status(upstream.status).json(data)
  } catch (err) {
    console.error('Proxy error:', err)
    return res.status(502).json({ error: 'Failed to reach Azure AI Foundry.', detail: err.message })
  }
}