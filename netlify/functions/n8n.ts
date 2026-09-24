import type { Handler } from '@netlify/functions';

/**
 * Server-side proxy for the n8n REST API v1 (Netlify Function on the main site).
 * The n8n API key lives only in the site's env vars.
 *
 * Authorization reuses the website's admin sign-in: the client sends its Firebase
 * ID token as `Authorization: Bearer <token>`, verified against the Supabase
 * `admin-api?op=me` endpoint. Only `is_admin` users are allowed.
 */

const ADMIN_ME_API =
  'https://msratyvmnuvozuthgkmi.supabase.co/functions/v1/admin-api?op=me';

async function isAdmin(authHeader: string | undefined): Promise<boolean> {
  if (!authHeader) return false;
  try {
    const res = await fetch(ADMIN_ME_API, { headers: { Authorization: authHeader } });
    if (!res.ok) return false;
    const me = (await res.json()) as { is_admin?: boolean };
    return Boolean(me.is_admin);
  } catch {
    return false;
  }
}

export const handler: Handler = async (event) => {
  const authHeader = event.headers['authorization'] || event.headers['Authorization'];
  if (!(await isAdmin(authHeader))) {
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
    return { statusCode: response.status, headers: { 'Content-Type': 'application/json' }, body: text };
  } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ error: err instanceof Error ? err.message : 'n8n proxy error' }) };
  }
};
