import type { Handler } from '@netlify/functions';
import { GoogleAuth } from 'google-auth-library';

/**
 * Server-side proxy for Google Sheets API v4 (Netlify Function on the main site).
 * Secrets live only in the site's env vars.
 *
 * Authorization reuses the website's existing admin sign-in: the client sends
 * its Firebase ID token as `Authorization: Bearer <token>`, which this function
 * verifies against the Supabase `admin-api?op=me` endpoint (same check the site
 * uses). Only `is_admin` users (e.g. shreyas@powerhousetech.in) are allowed.
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

  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const spreadsheetId = process.env.SPREADSHEET_ID;
  if (!b64 || !spreadsheetId) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server not configured (missing Google env).' }) };
  }

  let credentials: Record<string, unknown>;
  try {
    credentials = JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
  } catch {
    return { statusCode: 500, body: JSON.stringify({ error: 'GOOGLE_SERVICE_ACCOUNT_JSON is not valid base64 JSON.' }) };
  }

  try {
    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();

    // `path` already contains the sub-path + its own query string.
    const sheetsPath = event.queryStringParameters?.path || '';
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}${sheetsPath}`;

    const response = await fetch(url, {
      method: event.httpMethod,
      headers: {
        Authorization: `Bearer ${accessToken.token}`,
        'Content-Type': 'application/json',
      },
      body: event.httpMethod !== 'GET' ? event.body || undefined : undefined,
    });

    const text = await response.text();
    return { statusCode: response.status, headers: { 'Content-Type': 'application/json' }, body: text };
  } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ error: err instanceof Error ? err.message : 'Sheets proxy error' }) };
  }
};
