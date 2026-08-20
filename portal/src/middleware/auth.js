/**
 * Auth for outreach portal API:
 * 1. PORTAL_API_KEY — machine auth for n8n (Authorization: Bearer <key>)
 * 2. Firebase ID token of an admin — for the dashboard UI
 *
 * Public HTML shells are served, but every /api/* call requires one of the above.
 */

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'shreyas@powerhousetech.in')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const FIREBASE_WEB_API_KEY =
  process.env.FIREBASE_WEB_API_KEY || 'AIzaSyD9fHOILnFLauZqd-C2AZwm-vrkpQk-sV4';

const ADMIN_API_URL =
  process.env.ADMIN_API_URL ||
  'https://msratyvmnuvozuthgkmi.supabase.co/functions/v1/admin-api?op=me';

function bearer(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

async function verifyFirebaseIdToken(idToken) {
  const resp = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_WEB_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    },
  );
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = body?.error?.message || 'Invalid auth token';
    const err = new Error(msg);
    err.status = 401;
    throw err;
  }
  const user = body.users?.[0];
  if (!user?.email || !user.localId) {
    const err = new Error('Could not resolve signed-in user');
    err.status = 401;
    throw err;
  }
  return {
    email: String(user.email).trim().toLowerCase(),
    uid: user.localId,
  };
}

async function isAdminEmail(email, idToken) {
  const normalized = email.trim().toLowerCase();
  if (ADMIN_EMAILS.includes(normalized)) return true;

  // Prefer live admin flag from PowerhouseTech admin-api when available.
  if (!idToken || !ADMIN_API_URL) return false;
  try {
    const res = await fetch(ADMIN_API_URL, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data?.is_admin);
  } catch {
    return false;
  }
}

async function requireAuth(req, res, next) {
  try {
    const token = bearer(req);
    if (!token) {
      return res.status(401).json({ error: 'Sign in required' });
    }

    const apiKey = process.env.PORTAL_API_KEY || '';
    if (apiKey && token === apiKey) {
      req.auth = { type: 'api_key', email: 'n8n@system' };
      return next();
    }

    const user = await verifyFirebaseIdToken(token);
    const adminOk = await isAdminEmail(user.email, token);
    if (!adminOk) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.auth = { type: 'firebase', email: user.email, uid: user.uid };
    return next();
  } catch (err) {
    const status = err.status || 401;
    return res.status(status).json({ error: err.message || 'Unauthorized' });
  }
}

module.exports = { requireAuth, ADMIN_EMAILS };
