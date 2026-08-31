import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { bearerToken, verifyFirebaseIdToken } from '../_shared/firebase-auth.ts';
import { jsonResponse, optionsResponse } from '../_shared/cors.ts';
import { adminClient } from '../_shared/portal-users.ts';
import {
  COSTING_FIELDS,
  loadOrgDefaults,
  memberFromPortalUser,
  requireSahasraMember,
  type SahasraMember,
  type SahasraRole,
} from '../_shared/sahasra-auth.ts';
import { signPortalToken, verifyPortalToken } from '../_shared/sahasra-portal-session.ts';

function unauthorized(msg = 'Sign in required') {
  const err = new Error(msg);
  (err as Error & { status: number }).status = 401;
  return err;
}

function forbidden(msg = 'Access denied') {
  const err = new Error(msg);
  (err as Error & { status: number }).status = 403;
  return err;
}

function actorId(member: SahasraMember): string {
  return member.username || member.email;
}

async function resolveMember(req: Request): Promise<SahasraMember> {
  const token = bearerToken(req);
  if (!token) throw unauthorized();

  const portal = await verifyPortalToken(token);
  if (portal) {
    const db = adminClient();
    const { data } = await db
      .from('sahasra_portal_users')
      .select('username, org_id, full_name, role')
      .eq('username', portal.u)
      .maybeSingle();
    if (data) return memberFromPortalUser(data);
    return memberFromPortalUser({
      username: portal.u,
      org_id: portal.o,
      full_name: null,
      role: portal.r,
    });
  }

  try {
    const user = await verifyFirebaseIdToken(token);
    const member = await requireSahasraMember(user.email);
    return { ...member, username: member.email.split('@')[0] };
  } catch {
    throw unauthorized('Invalid or expired session');
  }
}

function assertRole(member: SahasraMember, allowed: SahasraRole[]) {
  if (!allowed.includes(member.role)) throw forbidden('You do not have permission for this action.');
}

function pickCostingPatch(body: Record<string, unknown>) {
  const patch: Record<string, unknown> = {};
  for (const key of COSTING_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      patch[key] = body[key];
    }
  }
  return patch;
}

async function writeAudit(
  costingId: string,
  actor: string,
  fieldName: string,
  oldValue: unknown,
  newValue: unknown,
) {
  if (String(oldValue ?? '') === String(newValue ?? '')) return;
  const db = adminClient();
  await db.from('sahasra_audit_log').insert({
    costing_id: costingId,
    user_email: actor,
    field_name: fieldName,
    old_value: oldValue == null ? null : String(oldValue),
    new_value: newValue == null ? '' : String(newValue),
  });
}

async function profilePayload(member: SahasraMember) {
  const defaults = await loadOrgDefaults(member.org_id);
  const db = adminClient();
  const { data: org } = await db
    .from('sahasra_organizations')
    .select('id, name, default_currency')
    .eq('id', member.org_id)
    .maybeSingle();
  return {
    username: member.username,
    email: member.email,
    full_name: member.full_name,
    role: member.role,
    org,
    defaults,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse();

  const url = new URL(req.url);
  const op = url.searchParams.get('op') || 'me';
  const id = url.searchParams.get('id');
  const db = adminClient();

  try {
    if (req.method === 'POST' && op === 'login') {
      let body: Record<string, unknown> = {};
      try {
        body = await req.json();
      } catch {
        body = {};
      }
      const username = String(body.username || '').trim();
      const password = String(body.password || '');
      if (!username || !password) {
        return jsonResponse(400, { error: 'Username and password are required' });
      }
      const { data, error } = await db.rpc('sahasra_verify_login', {
        p_username: username,
        p_password: password,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return jsonResponse(401, { error: 'Invalid username or password' });
      const member = memberFromPortalUser(row);
      const token = await signPortalToken({
        username: member.username,
        role: member.role,
        org_id: member.org_id,
      });
      return jsonResponse(200, {
        token,
        ...(await profilePayload(member)),
      });
    }

    if (op === 'me') {
      const member = await resolveMember(req);
      return jsonResponse(200, await profilePayload(member));
    }

    const member = await resolveMember(req);
    const actor = actorId(member);

    if (req.method === 'GET' && op === 'costings') {
      const status = url.searchParams.get('status');
      let q = db
        .from('sahasra_costings')
        .select('*')
        .eq('org_id', member.org_id)
        .order('updated_at', { ascending: false })
        .limit(200);
      if (status) q = q.eq('status', status);
      // Non-admins only see their own costings.
      if (member.role !== 'admin') {
        q = q.eq('created_by', actor);
      }
      const { data, error } = await q;
      if (error) throw error;
      return jsonResponse(200, { costings: data || [] });
    }

    if (req.method === 'GET' && op === 'costing' && id) {
      const { data, error } = await db
        .from('sahasra_costings')
        .select('*')
        .eq('id', id)
        .eq('org_id', member.org_id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return jsonResponse(404, { error: 'Costing not found' });
      if (member.role !== 'admin' && data.created_by !== actor) {
        return jsonResponse(403, { error: 'Access denied' });
      }
      const { data: audit } = await db
        .from('sahasra_audit_log')
        .select('id, user_email, field_name, old_value, new_value, changed_at')
        .eq('costing_id', id)
        .order('changed_at', { ascending: false })
        .limit(100);
      return jsonResponse(200, { costing: data, audit: audit || [] });
    }

    if (req.method === 'POST' && op === 'costing') {
      let body: Record<string, unknown> = {};
      try {
        body = await req.json();
      } catch {
        body = {};
      }
      const clientName = String(body.client_name || '').trim();
      const assemblyName = String(body.assembly_name || '').trim();
      if (!clientName || !assemblyName) {
        return jsonResponse(400, { error: 'client_name and assembly_name are required' });
      }
      const row = {
        org_id: member.org_id,
        client_name: clientName,
        assembly_name: assemblyName,
        currency: body.currency === 'INR' ? 'INR' : 'USD',
        exchange_rate: body.exchange_rate ?? null,
        created_by: actor,
        updated_by: actor,
        status: 'draft',
        current_step: 1,
      };
      const { data, error } = await db.from('sahasra_costings').insert(row).select('*').single();
      if (error) throw error;
      await writeAudit(data.id, actor, 'created', null, assemblyName);
      return jsonResponse(201, { costing: data });
    }

    if (req.method === 'PATCH' && op === 'costing' && id) {
      const { data: existing, error: fetchErr } = await db
        .from('sahasra_costings')
        .select('*')
        .eq('id', id)
        .eq('org_id', member.org_id)
        .maybeSingle();
      if (fetchErr) throw fetchErr;
      if (!existing) return jsonResponse(404, { error: 'Costing not found' });
      if (member.role !== 'admin' && existing.created_by !== actor) {
        return jsonResponse(403, { error: 'Access denied' });
      }
      if (['sent', 'approved'].includes(existing.status) && member.role !== 'admin') {
        return jsonResponse(403, { error: 'This costing is locked' });
      }

      let body: Record<string, unknown> = {};
      try {
        body = await req.json();
      } catch {
        body = {};
      }
      const patch = pickCostingPatch(body);
      patch.updated_by = actor;
      patch.updated_at = new Date().toISOString();

      const { data, error } = await db
        .from('sahasra_costings')
        .update(patch)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;

      for (const key of Object.keys(patch)) {
        if (key === 'updated_by' || key === 'updated_at') continue;
        await writeAudit(id, actor, key, (existing as Record<string, unknown>)[key], patch[key]);
      }

      return jsonResponse(200, { costing: data });
    }

    if (req.method === 'GET' && op === 'dashboard') {
      assertRole(member, ['admin']);
      const { data, error } = await db
        .from('sahasra_costings')
        .select('id, status, client_name, assembly_name, quantity, created_by, updated_by, updated_at')
        .eq('org_id', member.org_id)
        .order('updated_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      const rows = data || [];
      const byStatus: Record<string, number> = {};
      for (const r of rows) {
        byStatus[r.status] = (byStatus[r.status] || 0) + 1;
      }
      const { data: recentAudit } = await db
        .from('sahasra_audit_log')
        .select('id, costing_id, user_email, field_name, new_value, changed_at')
        .order('changed_at', { ascending: false })
        .limit(30);
      return jsonResponse(200, {
        summary: { total: rows.length, by_status: byStatus },
        recent_costings: rows.slice(0, 20),
        recent_activity: recentAudit || [],
      });
    }

    return jsonResponse(404, { error: 'Unknown operation' });
  } catch (err) {
    const status = (err as Error & { status?: number }).status ?? 500;
    return jsonResponse(status, {
      error: err instanceof Error ? err.message : 'Server error',
    });
  }
});
