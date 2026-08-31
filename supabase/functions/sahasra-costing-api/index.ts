import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { bearerToken, verifyFirebaseIdToken } from '../_shared/firebase-auth.ts';
import { jsonResponse, optionsResponse } from '../_shared/cors.ts';
import { adminClient } from '../_shared/portal-users.ts';
import {
  COSTING_FIELDS,
  loadOrgDefaults,
  requireSahasraMember,
  requireSahasraRole,
} from '../_shared/sahasra-auth.ts';

async function authedUser(req: Request) {
  const token = bearerToken(req);
  if (!token) {
    const err = new Error('Sign in required');
    (err as Error & { status: number }).status = 401;
    throw err;
  }
  const user = await verifyFirebaseIdToken(token);
  const member = await requireSahasraMember(user.email);
  return { user, member };
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
  userEmail: string,
  fieldName: string,
  oldValue: unknown,
  newValue: unknown,
) {
  if (String(oldValue ?? '') === String(newValue ?? '')) return;
  const db = adminClient();
  await db.from('sahasra_audit_log').insert({
    costing_id: costingId,
    user_email: userEmail,
    field_name: fieldName,
    old_value: oldValue == null ? null : String(oldValue),
    new_value: newValue == null ? '' : String(newValue),
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse();

  const url = new URL(req.url);
  const op = url.searchParams.get('op') || 'me';
  const id = url.searchParams.get('id');

  try {
    if (op === 'me') {
      const token = bearerToken(req);
      if (!token) return jsonResponse(401, { error: 'Sign in required' });
      const user = await verifyFirebaseIdToken(token);
      try {
        const member = await requireSahasraMember(user.email);
        const defaults = await loadOrgDefaults(member.org_id);
        const db = adminClient();
        const { data: org } = await db
          .from('sahasra_organizations')
          .select('id, name, default_currency')
          .eq('id', member.org_id)
          .maybeSingle();
        return jsonResponse(200, {
          email: member.email,
          full_name: member.full_name,
          role: member.role,
          org,
          defaults,
        });
      } catch (err) {
        const status = (err as Error & { status?: number }).status ?? 403;
        return jsonResponse(status, {
          error: err instanceof Error ? err.message : 'Access denied',
        });
      }
    }

    const { user, member } = await authedUser(req);
    const db = adminClient();

    if (req.method === 'GET' && op === 'costings') {
      const status = url.searchParams.get('status');
      let q = db
        .from('sahasra_costings')
        .select('*')
        .eq('org_id', member.org_id)
        .order('updated_at', { ascending: false })
        .limit(200);
      if (status) q = q.eq('status', status);
      if (member.role === 'costing_engineer') {
        q = q.eq('created_by', member.email);
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
      if (member.role === 'costing_engineer' && data.created_by !== member.email) {
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
        created_by: member.email,
        updated_by: member.email,
        status: 'draft',
        current_step: 1,
      };
      const { data, error } = await db.from('sahasra_costings').insert(row).select('*').single();
      if (error) throw error;
      await writeAudit(data.id, member.email, 'created', null, assemblyName);
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
      if (member.role === 'costing_engineer' && existing.created_by !== member.email) {
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
      patch.updated_by = member.email;
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
        await writeAudit(id, member.email, key, (existing as Record<string, unknown>)[key], patch[key]);
      }

      return jsonResponse(200, { costing: data });
    }

    if (req.method === 'GET' && op === 'dashboard') {
      await requireSahasraRole(user.email, ['admin', 'reviewer']);
      const { data, error } = await db
        .from('sahasra_costings')
        .select('id, status, client_name, assembly_name, quantity, created_by, updated_at')
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
        summary: {
          total: rows.length,
          by_status: byStatus,
        },
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
