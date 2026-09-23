import type { Handler } from '@netlify/functions';
import { GoogleAuth } from 'google-auth-library';

/**
 * Server-side proxy for Google Sheets API v4 (Netlify Function). Secrets live
 * only in Netlify env vars — never in the browser bundle.
 *
 * The client sends the full Sheets sub-path (everything after the spreadsheet
 * id, including any query string) URL-encoded in the `path` query param. Netlify
 * decodes query params once, so `path` arrives as the raw sub-path.
 */
export const handler: Handler = async (event) => {
  const token = event.headers['x-app-token'];
  if (!process.env.APP_PASSWORD || token !== process.env.APP_PASSWORD) {
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
    return {
      statusCode: response.status,
      headers: { 'Content-Type': 'application/json' },
      body: text,
    };
  } catch (err) {
    return {
      statusCode: 502,
      body: JSON.stringify({ error: err instanceof Error ? err.message : 'Sheets proxy error' }),
    };
  }
};
