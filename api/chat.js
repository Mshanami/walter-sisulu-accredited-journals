export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { input } = req.body;

    // Send only the latest user message as a plain string
    // Find the last user message in the array
    let userMessage = '';
    if (Array.isArray(input)) {
      const lastUser = [...input].reverse().find(m => m.role === 'user');
      userMessage = lastUser ? lastUser.content : '';
    } else {
      userMessage = String(input);
    }

    const body = { model: 'gpt-4.1', input: userMessage };

    console.log('Azure request body:', JSON.stringify(body));

    const azureRes = await fetch(
      'https://bmngomezulu-7756-resource.services.ai.azure.com/api/projects/bmngomezulu-7756/applications/LibraryAssistant/protocols/openai/responses?api-version=2025-11-15-preview',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': process.env.AZURE_AI_API_KEY,
        },
        body: JSON.stringify(body),
      }
    );

    const text = await azureRes.text();
    console.log('Azure response status:', azureRes.status);
    console.log('Azure response body:', text.slice(0, 500));

    if (!azureRes.ok) {
      return res.status(azureRes.status).json({ azureError: text });
    }

    const data = JSON.parse(text);
    return res.status(200).json(data);

  } catch (err) {
    console.error('Proxy error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}