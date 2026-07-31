// api/feedback.js — Logs LibAI chat feedback to Vercel logs
// View in: Vercel dashboard → your project → Logs → filter by "LIBAI_FEEDBACK"
// To also send to Google Sheets, set FEEDBACK_WEBHOOK_URL in Vercel environment variables

export const config = { api: { bodyParser: true } }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' })

  let body = req.body
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch { body = {} }
  }

  const { rating, message, ts, url } = body || {}

  if (!rating || !message) {
    return res.status(400).json({ error: 'Missing rating or message' })
  }

  const emoji   = rating === 'up' ? '👍' : '👎'
  const label   = rating === 'up' ? 'HELPFUL' : 'NOT_HELPFUL'
  const preview = String(message).slice(0, 200).replace(/\n/g, ' ')

  // Log to Vercel — visible in dashboard → Logs tab
  console.log(`LIBAI_FEEDBACK | ${label} | ${emoji} | ${ts} | "${preview}" | ${url}`)

  // Optional: forward to Google Sheets via a webhook (e.g. Zapier, Make, or Apps Script)
  const webhookUrl = process.env.FEEDBACK_WEBHOOK_URL
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, emoji, label, message, ts, url })
      })
    } catch (err) {
      console.error('Feedback webhook error:', err.message)
      // Don't fail the request — webhook is optional
    }
  }

  return res.status(200).json({ ok: true })
}
