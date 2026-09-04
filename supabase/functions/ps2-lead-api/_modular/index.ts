import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import {
  optionsResponse, jsonResponse, db, ORG_ID, resolveUser,
  unauthorized, forbidden, N8N_ACTOR, signPortalToken, logActivity,
} from './helpers.ts';
import { handleOps } from './ops.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse();

  const url = new URL(req.url);
  const op = url.searchParams.get('op') || '';
  const id = url.searchParams.get('id') || '';
  const method = req.method;

  // ── LOGIN (no auth required) ──────────────────────────────────────────────
  if (method === 'POST' && op === 'login') {
    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* */ }
    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    if (!username || !password) return jsonResponse(400, { ok: false, error: 'Username and password required' });

    const { data, error } = await db().rpc('sahasra_verify_login', {
      p_username: username,
      p_password: password,
    });
    if (error || !data?.[0]) {
      const { data: user } = await db()
        .from('ps2_users')
        .select('id, username, password_hash, full_name, role, organization_id, outlook_account')
        .eq('username', username)
        .eq('organization_id', ORG_ID)
        .eq('is_active', true)
        .maybeSingle();
      if (!user) return jsonResponse(401, { ok: false, error: 'Invalid credentials' });

      const { data: verified } = await db().rpc('ps2_verify_login', {
        p_username: username,
        p_password: password,
        p_org_id: ORG_ID,
      });
      if (!verified) return jsonResponse(401, { ok: false, error: 'Invalid credentials' });

      const token = await signPortalToken({
        username: user.username,
        role: user.role,
        org_id: user.organization_id,
      });
      await logActivity(user.id, 'session', null, 'login', `${user.full_name || user.username} signed in`);
      return jsonResponse(200, {
        ok: true,
        token,
        user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role, organization_id: user.organization_id, outlook_account: user.outlook_account },
      });
    }
    return jsonResponse(401, { ok: false, error: 'Invalid credentials' });
  }

  const user = await resolveUser(req);
  if (!user) return unauthorized();

  if (user.role === 'pt_admin' && !['settings', 'system-settings'].includes(op)) {
    return forbidden('pt_admin can only access system settings');
  }

  const isN8n = user.username === N8N_ACTOR.username;

  try {
    const handled = await handleOps(req, op, id, method, user, isN8n);
    if (handled) return handled;
    return jsonResponse(404, { ok: false, error: `Unknown op: ${op}` });
  } catch (err) {
    console.error('ps2-lead-api error', err);
    return jsonResponse(500, { ok: false, error: err instanceof Error ? err.message : 'Server error' });
  }
});
