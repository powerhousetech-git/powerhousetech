import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { bearerToken, verifyFirebaseIdToken } from '../_shared/firebase-auth.ts';
import { jsonResponse, optionsResponse } from '../_shared/cors.ts';
import { upsertPortalSession } from '../_shared/portal-users.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse();
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });

  const token = bearerToken(req);
  if (!token) return jsonResponse(401, { error: 'Sign in required' });

  let user;
  try {
    user = await verifyFirebaseIdToken(token);
  } catch (err) {
    return jsonResponse(401, {
      error: err instanceof Error ? err.message : 'Invalid sign-in session',
    });
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = await req.json();
  } catch {
    payload = {};
  }

  const eventType = String(payload.event_type || 'session').slice(0, 64);
  const path = payload.path != null ? String(payload.path).slice(0, 512) : null;
  const meta =
    payload.meta && typeof payload.meta === 'object' && !Array.isArray(payload.meta)
      ? (payload.meta as Record<string, unknown>)
      : {};

  try {
    const result = await upsertPortalSession({
      email: user.email,
      firebase_uid: user.uid,
      display_name: payload.display_name != null ? String(payload.display_name) : null,
      photo_url: payload.photo_url != null ? String(payload.photo_url) : null,
      company: payload.company != null ? String(payload.company).slice(0, 200) : undefined,
      phone: payload.phone != null ? String(payload.phone).slice(0, 40) : undefined,
      path,
      event_type: eventType,
      meta,
    });

    return jsonResponse(200, {
      ok: true,
      email: result.user.email,
      is_admin: result.is_admin,
      display_name: result.user.display_name,
      login_count: result.user.login_count,
    });
  } catch (err) {
    return jsonResponse(500, {
      error: err instanceof Error ? err.message : 'portal-session error',
    });
  }
});
