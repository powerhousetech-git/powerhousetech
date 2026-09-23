import type { Handler } from '@netlify/functions';

/**
 * Server-side proxy for the n8n REST API v1 (Netlify Function). The n8n API key
 * lives only in Netlify env vars. The client sends the sub-path (after
 * `/api/v1/`), including any query string, URL-encoded in `path`.
 */
export const handler: Handler = async (event) => {
  const token = event.headers['x-app-token'];
  if (!process.env.APP_PASSWORD || token !== process.env.APP_PASSWORD) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const base = process.env.N8N_BASE_URL;
  const apiKey = process.env.N8N_API_KEY;
  if (!base || !apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server not configured (missing n8n env).' }) };
  }

  const n8nPath = event.queryStringParameters?.path || '';
  const url = `${base.replace(/\/$/, '')}/api/v1/${n8nPath}`;

  try {
    const response = await fetch(url, {
      method: event.httpMethod,
      headers: {
        'X-N8N-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: event.httpMethod !== 'GET' ? event.body || undefined : undefined,
    });

    const text = await response.text();
    return {
      statusCode: response.status,
      headers: { 'Content-Type': 'application/json' },
      body: text,
    };
  } catch (err) {
    return {
      statusCode: 502,
      body: JSON.stringify({ error: err instanceof Error ? err.message : 'n8n proxy error' }),
    };
  }
};
