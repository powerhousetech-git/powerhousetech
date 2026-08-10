import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { bearerToken, verifyFirebaseIdToken } from '../_shared/firebase-auth.ts';
import { jsonResponse, optionsResponse } from '../_shared/cors.ts';
import { adminClient, requireAdmin } from '../_shared/portal-users.ts';
import {
  GENERAL_ACCESS,
  LIVE_SERVICES,
  accessFromRow,
  serviceById,
} from '../_shared/live-services.ts';

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
      const [{ data: users, error: usersErr }, { data: ents, error: entsErr }] =
        await Promise.all([
          db
            .from('portal_users')
            .select(
              'email, display_name, company, phone, is_admin, login_count, last_seen_at, last_path'
            )
            .order('last_seen_at', { ascending: false })
            .limit(500),
          db
            .from('user_service_entitlements')
            .select(
              'email, ai_sales_outreach_enabled, card_capture_enabled, invoice_radar_enabled, invoice_radar_web_app_url, created_at, updated_at'
            )
            .limit(500),
        ]);
      if (usersErr) throw usersErr;
      if (entsErr) throw entsErr;

      const entByEmail = new Map(
        (ents || []).map((r) => [String(r.email).toLowerCase(), r])
      );

      const catalog = LIVE_SERVICES.map(({ id, label, short }) => ({
        id,
        label,
        short,
      }));

      const rows = (users || []).map((u) => {
        const email = String(u.email).toLowerCase();
        const ent = entByEmail.get(email) as Record<string, unknown> | undefined;
        const access = accessFromRow(ent);
        return {
          email,
          display_name: u.display_name || '',
          company: u.company || '',
          phone: u.phone || '',
          is_admin: Boolean(u.is_admin),
          login_count: u.login_count ?? 0,
          last_seen_at: u.last_seen_at,
          last_path: u.last_path || '',
          general_access: true,
          access,
          invoice_radar_web_app_configured: Boolean(ent?.invoice_radar_web_app_url),
          // Back-compat for older admin UI
          invoice_radar_enabled: access.invoice_radar,
        };
      });

      return jsonResponse(200, {
        general_access: GENERAL_ACCESS,
        services: catalog,
        entitlements: rows,
        users: rows,
      });
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

      // Prefer service id; keep invoice_radar_enabled for older clients.
      let serviceId = String(body.service || '').trim();
      let enabled: boolean;
      if (serviceId) {
        enabled = Boolean(body.enabled);
      } else if (body.invoice_radar_enabled !== undefined) {
        serviceId = 'invoice_radar';
        enabled = Boolean(body.invoice_radar_enabled);
      } else {
        return jsonResponse(400, {
          error: 'service + enabled required (or invoice_radar_enabled)',
        });
      }

      const def = serviceById(serviceId);
      if (!def) {
        return jsonResponse(400, {
          error: 'Unknown service. Use: ' + LIVE_SERVICES.map((s) => s.id).join(', '),
        });
      }

      const patch: Record<string, unknown> = {
        email,
        [def.column]: enabled,
        updated_at: new Date().toISOString(),
      };

      const { error } = await db.from('user_service_entitlements').upsert(patch, {
        onConflict: 'email',
      });
      if (error) throw error;

      await db.from('portal_events').insert({
        email: admin.email,
        event_type: 'admin_entitlement_update',
        path: '/admin',
        meta: { target: email, service: def.id, enabled },
      });

      return jsonResponse(200, {
        ok: true,
        email,
        service: def.id,
        enabled,
        // Back-compat
        invoice_radar_enabled:
          def.id === 'invoice_radar' ? enabled : undefined,
      });
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
