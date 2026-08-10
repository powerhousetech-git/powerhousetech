import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { bearerToken, verifyFirebaseIdToken } from '../_shared/firebase-auth.ts';
import { jsonResponse, optionsResponse } from '../_shared/cors.ts';
import { adminClient, requireAdmin } from '../_shared/portal-users.ts';

async function authedAdmin(req: Request) {
  const token = bearerToken(req);
  if (!token) {
    const err = new Error('Sign in required');
    (err as Error & { status: number }).status = 401;
    throw err;
  }
  const user = await verifyFirebaseIdToken(token);
  const admin = await requireAdmin(user.email);
  return { user, admin };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse();

  const url = new URL(req.url);
  const op = url.searchParams.get('op') || 'me';

  try {
    if (op === 'me') {
      // me works for any signed-in user (returns is_admin false if not admin)
      const token = bearerToken(req);
      if (!token) return jsonResponse(401, { error: 'Sign in required' });
      const user = await verifyFirebaseIdToken(token);
      const db = adminClient();
      const { data } = await db
        .from('portal_users')
        .select('email, display_name, is_admin, company, phone, login_count, last_seen_at')
        .eq('email', user.email)
        .maybeSingle();
      const isAdmin =
        Boolean(data?.is_admin) || user.email === 'shreyas@powerhousetech.in';
      return jsonResponse(200, {
        email: user.email,
        is_admin: isAdmin,
        display_name: data?.display_name ?? null,
        company: data?.company ?? null,
        phone: data?.phone ?? null,
        login_count: data?.login_count ?? 0,
        last_seen_at: data?.last_seen_at ?? null,
      });
    }

    const { admin } = await authedAdmin(req);
    const db = adminClient();

    if (req.method === 'GET' && op === 'users') {
      const { data, error } = await db
        .from('portal_users')
        .select(
          'email, display_name, company, phone, is_admin, first_seen_at, last_seen_at, login_count, last_path, firebase_uid'
        )
        .order('last_seen_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return jsonResponse(200, { users: data || [] });
    }

    if (req.method === 'GET' && op === 'events') {
      const email = url.searchParams.get('email');
      let q = db
        .from('portal_events')
        .select('id, email, event_type, path, meta, created_at')
        .order('created_at', { ascending: false })
        .limit(200);
      if (email) q = q.eq('email', email.trim().toLowerCase());
      const { data, error } = await q;
      if (error) throw error;
      return jsonResponse(200, { events: data || [] });
    }

    if (req.method === 'GET' && op === 'entitlements') {
      const { data, error } = await db
        .from('user_service_entitlements')
        .select(
          'email, invoice_radar_enabled, invoice_radar_web_app_url, created_at, updated_at'
        )
        .order('updated_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      // Never return client keys
      const rows = (data || []).map((r) => ({
        ...r,
        has_client_key: Boolean(
          (r as { invoice_radar_client_key?: string }).invoice_radar_client_key
        ),
        invoice_radar_web_app_configured: Boolean(r.invoice_radar_web_app_url),
        invoice_radar_web_app_url: r.invoice_radar_web_app_url
          ? String(r.invoice_radar_web_app_url).slice(0, 48) + '…'
          : null,
      }));
      return jsonResponse(200, { entitlements: rows });
    }

    if (req.method === 'GET' && op === 'credits') {
      const { data, error } = await db
        .from('user_run_credits')
        .select('email, runs_remaining, runs_used, last_tool_used')
        .order('runs_used', { ascending: false })
        .limit(500);
      if (error) throw error;
      return jsonResponse(200, { credits: data || [] });
    }

    if (req.method === 'GET' && op === 'export') {
      const { data: users, error } = await db
        .from('portal_users')
        .select(
          'email, display_name, company, phone, is_admin, first_seen_at, last_seen_at, login_count, last_path'
        )
        .order('last_seen_at', { ascending: false });
      if (error) throw error;
      const header =
        'email,display_name,company,phone,is_admin,first_seen_at,last_seen_at,login_count,last_path';
      const lines = (users || []).map((u) =>
        [
          u.email,
          JSON.stringify(u.display_name || ''),
          JSON.stringify(u.company || ''),
          JSON.stringify(u.phone || ''),
          u.is_admin,
          u.first_seen_at,
          u.last_seen_at,
          u.login_count,
          JSON.stringify(u.last_path || ''),
        ].join(',')
      );
      const csv = [header, ...lines].join('\n');
      return new Response(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="portal-users.csv"',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    if (req.method === 'POST' && op === 'entitlement') {
      const body = await req.json().catch(() => ({}));
      const email = String(body.email || '')
        .trim()
        .toLowerCase();
      if (!email || !email.includes('@')) {
        return jsonResponse(400, { error: 'Valid email required' });
      }
      const enabled = Boolean(body.invoice_radar_enabled);
      const { error } = await db.from('user_service_entitlements').upsert(
        {
          email,
          invoice_radar_enabled: enabled,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'email' }
      );
      if (error) throw error;
      await db.from('portal_events').insert({
        email: admin.email,
        event_type: 'admin_entitlement_update',
        path: '/admin',
        meta: { target: email, invoice_radar_enabled: enabled },
      });
      return jsonResponse(200, { ok: true, email, invoice_radar_enabled: enabled });
    }

    if (req.method === 'POST' && op === 'set_admin') {
      // Only seeded super-admin can promote others
      if (admin.email !== 'shreyas@powerhousetech.in') {
        return jsonResponse(403, { error: 'Only the primary admin can manage admins' });
      }
      const body = await req.json().catch(() => ({}));
      const email = String(body.email || '')
        .trim()
        .toLowerCase();
      const isAdmin = Boolean(body.is_admin);
      if (!email) return jsonResponse(400, { error: 'email required' });
      const { error } = await db.from('portal_users').upsert(
        {
          email,
          is_admin: isAdmin,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: 'email' }
      );
      if (error) throw error;
      return jsonResponse(200, { ok: true, email, is_admin: isAdmin });
    }

    if (req.method === 'POST' && op === 'profile') {
      const body = await req.json().catch(() => ({}));
      const email = String(body.email || '')
        .trim()
        .toLowerCase();
      if (!email) return jsonResponse(400, { error: 'email required' });
      const patch: Record<string, unknown> = {};
      if (body.company !== undefined) patch.company = String(body.company).slice(0, 200);
      if (body.phone !== undefined) patch.phone = String(body.phone).slice(0, 40);
      if (body.display_name !== undefined) {
        patch.display_name = String(body.display_name).slice(0, 200);
      }
      const { error } = await db.from('portal_users').update(patch).eq('email', email);
      if (error) throw error;
      return jsonResponse(200, { ok: true });
    }

    return jsonResponse(400, { error: 'Unknown op' });
  } catch (err) {
    const status = (err as { status?: number })?.status || 500;
    return jsonResponse(status === 403 ? 403 : status === 401 ? 401 : 500, {
      error: err instanceof Error ? err.message : 'admin-api error',
    });
  }
});
