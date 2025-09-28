import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { messages, model } = req.body || {};
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const chosenModel = process.env.OPENAI_MODEL || model || 'gpt-4o-mini';

  if (!OPENAI_API_KEY) {
    // Mock path for local testing without keys
    const lastUser = (messages || []).filter((m:any)=>m.role==='user').slice(-1)[0];
    const text = (lastUser?.content || '')
      .toString()
      .slice(0, 300);
    return res.status(200).json({ content: `🤖 MOCK: I received your request and would respond based on this input:\n---\n${text}\n---\n(Set OPENAI_API_KEY in .env to use a real model.)` });
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: chosenModel,
        messages,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: 'Provider error', detail: err });
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || '';
    res.status(200).json({ content });
  } catch (e:any) {
    res.status(500).json({ error: 'Unexpected error', detail: e?.message || String(e) });
  }
}
