import type { VercelRequest, VercelResponse } from '@vercel/node';

/** Validates the single shared app password. */
export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  if (!process.env.APP_PASSWORD) {
    return res.status(500).json({ error: 'Server not configured (APP_PASSWORD missing).' });
  }

  const password = (req.body as { password?: string } | undefined)?.password;
  if (password && password === process.env.APP_PASSWORD) {
    return res.status(200).json({ ok: true });
  }
  return res.status(401).json({ error: 'Wrong password' });
}
