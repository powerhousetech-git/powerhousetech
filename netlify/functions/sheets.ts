import { createSign } from 'node:crypto';

/**
 * Server-side proxy for Google Sheets API v4 (Netlify Function on the main site).
 * Self-contained: uses only Node built-ins (no npm dependencies) so it bundles
 * cleanly and doesn't change the main site's build. Signs the service-account
 * JWT with node:crypto (RS256) and exchanges it for an access token.
 *
 * Authorization reuses the website's admin sign-in: the client sends its Firebase
 * ID token as `Authorization: Bearer <token>`, verified against the Supabase
 * `admin-api?op=me` endpoint. Only `is_admin` users are allowed.
 */

interface NetlifyEvent {
  httpMethod: string;
  headers: Record<string, string | undefined>;
  queryStringParameters: Record<string, string | undefined> | null;
  body: string | null;
}
interface NetlifyResult {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
}

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

interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  if (cachedToken && cachedToken.expiresAt - 60_000 > Date.now()) return cachedToken.token;

  const tokenUri = sa.token_uri || 'https://oauth2.googleapis.com/token';
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const claim = Buffer.from(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: tokenUri,
      iat: now,
      exp: now + 3600,
    }),
  ).toString('base64url');
  const signingInput = `${header}.${claim}`;
  const signature = createSign('RSA-SHA256').update(signingInput).sign(sa.private_key, 'base64url');
  const assertion = `${signingInput}.${signature}`;

  const res = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }).toString(),
  });
  if (!res.ok) {
    throw new Error(`Token exchange failed (${res.status}): ${await res.text().catch(() => '')}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

export const handler = async (event: NetlifyEvent): Promise<NetlifyResult> => {
  const authHeader = event.headers['authorization'] || event.headers['Authorization'];
  if (!(await isAdmin(authHeader))) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const spreadsheetId = process.env.SPREADSHEET_ID;
  if (!b64 || !spreadsheetId) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server not configured (missing Google env).' }) };
  }

  let sa: ServiceAccount;
  try {
    sa = JSON.parse(Buffer.from(b64, 'base64').toString('utf-8')) as ServiceAccount;
    if (!sa.client_email || !sa.private_key) throw new Error('missing fields');
  } catch {
    return { statusCode: 500, body: JSON.stringify({ error: 'GOOGLE_SERVICE_ACCOUNT_JSON is not a valid base64 service-account JSON.' }) };
  }

  try {
    const accessToken = await getAccessToken(sa);
    const sheetsPath = event.queryStringParameters?.path || '';
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}${sheetsPath}`;

    const response = await fetch(url, {
      method: event.httpMethod,
      headers: {
        Authorization: `Bearer ${accessToken}`,
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
