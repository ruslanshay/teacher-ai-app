import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Simple chat message type (matches your frontend)
 */
type Msg = { role: 'system' | 'user' | 'assistant'; content: string };

/**
 * Increase body size a bit for larger prompts if needed.
 */
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};

/**
 * Environment & defaults
 *
 * Required:
 *   - OPENAI_API_KEY
 *
 * Optional:
 *   - OPENAI_BASE_URL  (default: https://api.openai.com/v1)
 *   - OPENAI_MODEL     (default: gpt-3.5-turbo)
 *   - OPENROUTER_REFERRER, OPENROUTER_TITLE (if using OpenRouter)
 *   - OPENAI_TIMEOUT_MS (default: 60000)
 */
const getEnv = () => {
  const key = (process.env.OPENAI_API_KEY || '').trim();
  const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const model = (process.env.OPENAI_MODEL || 'gpt-3.5-turbo').trim();
  const timeoutMs = Number(process.env.OPENAI_TIMEOUT_MS || 60000);
  return { key, baseUrl, model, timeoutMs };
};

function badRequest(res: NextApiResponse, message: string, detail?: unknown) {
  return res.status(400).json({ error: message, detail });
}

function serverError(res: NextApiResponse, message: string, detail?: unknown) {
  return res.status(500).json({ error: message, detail });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { key, baseUrl, model: defaultModel, timeoutMs } = getEnv();
  if (!key) {
    return serverError(res, 'Missing OPENAI_API_KEY in .env.local');
  }

  // Parse body and validate
  const body = (req.body || {}) as {
    messages?: Msg[];
    model?: string;
    temperature?: number;
    top_p?: number;
    max_tokens?: number;
  };

  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (!messages.length) {
    return badRequest(res, 'Body must include { messages: Msg[] }');
  }

  // Basic message validation & sanitization
  const safeMessages: Msg[] = [];
  for (const m of messages) {
    if (!m || typeof m !== 'object') continue;
    if (!m.role || !m.content || typeof m.content !== 'string') continue;
    if (m.role !== 'system' && m.role !== 'user' && m.role !== 'assistant') continue;
    safeMessages.push({ role: m.role, content: m.content });
  }
  if (!safeMessages.length) {
    return badRequest(res, 'No valid messages after validation.');
  }

  // Limit messages to prevent runaway payloads
  if (safeMessages.length > 60) {
    return badRequest(res, 'Too many messages. Please reduce conversation size.');
  }

  // Optional knobs
  const model = (body.model || defaultModel).trim();
  const temperature =
    typeof body.temperature === 'number' && body.temperature >= 0 && body.temperature <= 2
      ? body.temperature
      : 0.2;
  const top_p =
    typeof body.top_p === 'number' && body.top_p > 0 && body.top_p <= 1 ? body.top_p : undefined;
  const max_tokens =
    typeof body.max_tokens === 'number' && body.max_tokens > 1 ? Math.min(body.max_tokens, 4096) : undefined;

  // Are we using OpenRouter? Add their recommended headers.
  const isOpenRouter = baseUrl.includes('openrouter.ai');

  // Timeout controller
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);

  try {
    // Call Chat Completions-compatible endpoint
    const r = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      signal: ac.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        ...(isOpenRouter
          ? {
              'HTTP-Referer': process.env.OPENROUTER_REFERRER || 'http://localhost:3000',
              'X-Title': process.env.OPENROUTER_TITLE || 'Teacher AI',
            }
          : {}),
      },
      body: JSON.stringify({
        model,
        messages: safeMessages,
        temperature,
        ...(top_p ? { top_p } : {}),
        ...(max_tokens ? { max_tokens } : {}),
        stream: false,
      }),
    });

    if (!r.ok) {
      // Try to extract JSON error; fall back to text
      let upstream: any = null;
      try {
        upstream = await r.json();
      } catch {
        upstream = await r.text();
      }
      console.error('Upstream error:', r.status, upstream);
      return res.status(502).json({
        error: `Upstream returned ${r.status}`,
        detail: upstream,
        model,
        provider: isOpenRouter ? 'openrouter' : 'openai',
      });
    }

    const data = await r.json();

    // Extract content safely for both OpenAI & OpenRouter (same shape)
    const text: string =
      data?.choices?.[0]?.message?.content ??
      data?.choices?.[0]?.text ??
      '';

    // Optionally forward token usage (helps debugging/costs)
    const usage = data?.usage || undefined;

    return res.status(200).json({
      content: typeof text === 'string' ? text : '',
      model,
      provider: isOpenRouter ? 'openrouter' : 'openai',
      ...(usage ? { usage } : {}),
    });
  } catch (err: any) {
    const aborted = err?.name === 'AbortError';
    console.error('API /generate failed:', aborted ? 'Timeout/Abort' : err);
    return serverError(res, aborted ? 'Upstream request timed out' : 'Server error', String(err?.message || err));
  } finally {
    clearTimeout(t);
  }
}
