import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Server-side proxy for the n8n REST API v1. The n8n API key lives only in
 * Vercel env vars. The client sends the sub-path (after /api/v1/), including any
 * query string, URL-encoded in the `path` query param.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = req.headers['x-app-token'];
  if (!process.env.APP_PASSWORD || token !== process.env.APP_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const base = process.env.N8N_BASE_URL;
  const apiKey = process.env.N8N_API_KEY;
  if (!base || !apiKey) {
    return res.status(500).json({ error: 'Server not configured (missing n8n env).' });
  }

  // The client encodes the sub-path once; the platform decodes query values
  // once, so `req.query.path` is already the raw sub-path (+ its query string).
  const rawPath = Array.isArray(req.query.path) ? req.query.path[0] : req.query.path;
  const subPath = rawPath ?? '';
  const url = `${base.replace(/\/$/, '')}/api/v1/${subPath}`;

  try {
    const upstream = await fetch(url, {
      method: req.method || 'GET',
      headers: {
        'X-N8N-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: req.method && req.method !== 'GET' ? JSON.stringify(req.body ?? {}) : undefined,
    });

    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', 'application/json');
    return res.send(text);
  } catch (err) {
    return res.status(502).json({
      error: err instanceof Error ? err.message : 'n8n proxy error',
    });
  }
}
