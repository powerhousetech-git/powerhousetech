import type { Handler } from '@netlify/functions';

/** Validates the single shared app password (Netlify Function). */
export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  if (!process.env.APP_PASSWORD) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server not configured (APP_PASSWORD missing).' }) };
  }

  let password: string | undefined;
  try {
    password = (JSON.parse(event.body || '{}') as { password?: string }).password;
  } catch {
    password = undefined;
  }

  if (password && password === process.env.APP_PASSWORD) {
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  }
  return { statusCode: 401, body: JSON.stringify({ error: 'Wrong password' }) };
};
