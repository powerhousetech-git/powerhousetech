import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleAuth } from 'google-auth-library';

/**
 * Server-side proxy for Google Sheets API v4. Secrets (service-account key,
 * spreadsheet id) live only in Vercel env vars — never in the browser bundle.
 *
 * The client sends the full Sheets sub-path (everything after the spreadsheet
 * id, including any query string) URL-encoded in the `path` query param, e.g.
 *   /api/sheets?path=%2Fvalues%3AbatchGet%3Franges%3D...%26majorDimension%3DROWS
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = req.headers['x-app-token'];
  if (!process.env.APP_PASSWORD || token !== process.env.APP_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const spreadsheetId = process.env.SPREADSHEET_ID;
  if (!b64 || !spreadsheetId) {
    return res.status(500).json({ error: 'Server not configured (missing Google env).' });
  }

  let credentials: Record<string, unknown>;
  try {
    credentials = JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
  } catch {
    return res.status(500).json({ error: 'GOOGLE_SERVICE_ACCOUNT_JSON is not valid base64 JSON.' });
  }

  try {
    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();

    // `path` carries the sub-path + its own query string. The client encodes it
    // once with encodeURIComponent; the platform decodes query values once, so
    // `req.query.path` is already the raw sub-path. fetch()/URL normalizes any
    // remaining spaces in the range to %20.
    const rawPath = Array.isArray(req.query.path) ? req.query.path[0] : req.query.path;
    const subPath = rawPath ?? '';
    const fullUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}${subPath}`;

    const upstream = await fetch(fullUrl, {
      method: req.method || 'GET',
      headers: {
        Authorization: `Bearer ${accessToken.token}`,
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
      error: err instanceof Error ? err.message : 'Sheets proxy error',
    });
  }
}
