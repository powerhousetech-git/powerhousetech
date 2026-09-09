import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function optionsResponse(): Response {
  return new Response(null, { status: 204, headers: corsHeaders });
}


type FirebaseUser = {
  email: string;
  uid: string;
};

async function verifyFirebaseIdToken(idToken: string): Promise<FirebaseUser> {
  const apiKey = Deno.env.get('FIREBASE_WEB_API_KEY')
    ?? 'AIzaSyD9fHOILnFLauZqd-C2AZwm-vrkpQk-sV4';

  const resp = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    },
  );

  const body = await resp.json().catch(() => ({}));

  if (!resp.ok) {
    const msg = (body as { error?: { message?: string } })?.error?.message || 'Invalid auth token';
    throw new Error(msg);
  }

  const user = (body as { users?: { email?: string; localId?: string }[] }).users?.[0];
  if (!user?.email || !user.localId) {
    throw new Error('Could not resolve signed-in user');
  }

  return {
    email: user.email.trim().toLowerCase(),
    uid: user.localId,
  };
}

function bearerToken(req: Request): string | null {
  const header = req.headers.get('Authorization') || '';
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
}


function adminClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    throw new Error('Supabase service credentials are not configured.');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

type PortalUserRow = {
  email: string;
  firebase_uid: string | null;
  display_name: string | null;
  photo_url: string | null;
  company: string | null;
  phone: string | null;
  is_admin: boolean;
  first_seen_at: string;
  last_seen_at: string;
  login_count: number;
  last_path: string | null;
};

async function upsertPortalSession(input: {
  email: string;
  firebase_uid: string;
  display_name?: string | null;
  photo_url?: string | null;
  path?: string | null;
  event_type?: string;
  meta?: Record<string, unknown>;
  company?: string | null;
  phone?: string | null;
}): Promise<{ user: PortalUserRow; is_admin: boolean }> {
  const db = adminClient();
  const email = input.email.trim().toLowerCase();

  const { data: existing } = await db
    .from('portal_users')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    email,
    firebase_uid: input.firebase_uid,
    last_seen_at: now,
    last_path: input.path ?? existing?.last_path ?? null,
  };

  if (input.display_name) patch.display_name = input.display_name;
  if (input.photo_url) patch.photo_url = input.photo_url;
  if (input.company !== undefined) patch.company = input.company;
  if (input.phone !== undefined) patch.phone = input.phone;

  if (!existing) {
    patch.first_seen_at = now;
    patch.login_count = 1;
    patch.is_admin = email === 'shreyas@powerhousetech.in';
  } else if (input.event_type === 'sign_in') {
    patch.login_count = Number(existing.login_count || 0) + 1;
  }

  const { data: user, error } = await db
    .from('portal_users')
    .upsert(patch, { onConflict: 'email' })
    .select('*')
    .single();

  if (error || !user) {
    throw new Error('Could not upsert portal user: ' + (error?.message || 'unknown'));
  }

  // Ensure seeded admin stays admin
  if (email === 'shreyas@powerhousetech.in' && !user.is_admin) {
    await db.from('portal_users').update({ is_admin: true }).eq('email', email);
    user.is_admin = true;
  }

  if (input.event_type) {
    const { error: evErr } = await db.from('portal_events').insert({
      email,
      event_type: input.event_type,
      path: input.path ?? null,
      meta: input.meta ?? {},
    });
    if (evErr) {
      console.error('portal_events insert failed', evErr.message);
    }
  }

  return { user: user as PortalUserRow, is_admin: Boolean(user.is_admin) };
}

async function requireAdmin(email: string): Promise<PortalUserRow> {
  const db = adminClient();
  const normalized = email.trim().toLowerCase();
  const { data, error } = await db
    .from('portal_users')
    .select('*')
    .eq('email', normalized)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.is_admin) {
    const err = new Error('Admin access required');
    (err as Error & { status: number }).status = 403;
    throw err;
  }
  return data as PortalUserRow;
}




type SahasraRole = 'costing_engineer' | 'reviewer' | 'admin';

type SahasraMember = {
  email: string;
  username: string;
  org_id: string;
  full_name: string | null;
  role: SahasraRole;
};

function memberFromPortalUser(row: {
  username: string;
  org_id: string;
  full_name: string | null;
  role: string;
}): SahasraMember {
  return {
    username: row.username,
    email: row.username + '@portal.sahasra',
    org_id: row.org_id,
    full_name: row.full_name,
    role: row.role as SahasraRole,
  };
}

type OrgDefaults = {
  freight_in_pct: number;
  inventory_carrying_pct: number;
  rejection_pct: number;
  overhead_pct: number;
  freight_out_pct: number;
  margin_pct: number;
  labour_elec_multiplier: number;
  pcb_tooling_default: number;
};

async function requireSahasraMember(email: string): Promise<SahasraMember> {
  const db = adminClient();
  const { data, error } = await db
    .from('sahasra_org_members')
    .select('email, org_id, full_name, role')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    const err = new Error('This Google account is not on the Sahasra portal yet.');
    (err as Error & { status: number }).status = 403;
    throw err;
  }

  return data as SahasraMember;
}

async function requireSahasraRole(
  email: string,
  allowed: SahasraRole[],
): Promise<SahasraMember> {
  const member = await requireSahasraMember(email);
  if (!allowed.includes(member.role)) {
    const err = new Error('You do not have permission for this action.');
    (err as Error & { status: number }).status = 403;
    throw err;
  }
  return member;
}

async function loadOrgDefaults(orgId: string): Promise<OrgDefaults> {
  const db = adminClient();
  const { data, error } = await db
    .from('sahasra_org_defaults')
    .select(
      'freight_in_pct, inventory_carrying_pct, rejection_pct, overhead_pct, freight_out_pct, margin_pct, labour_elec_multiplier, pcb_tooling_default',
    )
    .eq('org_id', orgId)
    .maybeSingle();

  if (error) throw error;

  const row = data || {};
  return {
    freight_in_pct: Number(row.freight_in_pct ?? 5),
    inventory_carrying_pct: Number(row.inventory_carrying_pct ?? 1),
    rejection_pct: Number(row.rejection_pct ?? 1),
    overhead_pct: Number(row.overhead_pct ?? 3),
    freight_out_pct: Number(row.freight_out_pct ?? 5),
    margin_pct: Number(row.margin_pct ?? 10),
    labour_elec_multiplier: Number(row.labour_elec_multiplier ?? 0.005),
    pcb_tooling_default: Number(row.pcb_tooling_default ?? 600),
  };
}

const COSTING_FIELDS = [
  'client_name',
  'assembly_name',
  'currency',
  'exchange_rate',
  'status',
  'current_step',
  'quantity',
  'bom_cost_elec',
  'bom_cost_mech',
  'pcb_cost',
  'freight_in_pct_override',
  'inventory_carrying_pct_override',
  'labour_elec_override',
  'labour_mech',
  'functional_ict_testing',
  'programming',
  'lubrication_grease',
  'aoi',
  'pca_labeling',
  'packaging_forwarding',
  'smt_pth',
  'pcb_vendor',
  'pcb_price',
  'pcb_size',
  'pcb_layer',
  'pcb_tooling_override',
  'smt_stencil',
  'mech_pkg_dev_tooling',
  'misc_tooling',
  'parts_lead_time',
  'production_lead_time',
  'engineering_lead_time',
  'rejection_pct_override',
  'overhead_pct_override',
  'freight_out_pct_override',
  'margin_pct_override',
  'na_fields',
  'true_margin',
  'true_quote_price',
  'true_value_addition',
  'true_value_updated_at',
  'true_value_updated_by',
  'exported_at',
  'deleted_at',
  'calc_margin',
  'calc_quote_price',
  'calc_value_addition',
] as const;


const PREFIX = 'sp1.';

type PortalPayload = {
  u: string;
  r: string;
  o: string;
  e: number;
};

function secretKey(): string {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!key) throw new Error('Service role key not configured');
  return key;
}

async function hmacSign(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secretKey()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function hmacVerify(message: string, signature: string): Promise<boolean> {
  const expected = await hmacSign(message);
  return expected === signature;
}

async function signPortalToken(input: {
  username: string;
  role: string;
  org_id: string;
}): Promise<string> {
  const payload = btoa(
    JSON.stringify({
      u: input.username,
      r: input.role,
      o: input.org_id,
      e: Date.now() + 7 * 24 * 60 * 60 * 1000,
    } satisfies PortalPayload),
  );
  const sig = await hmacSign(payload);
  return PREFIX + payload + '.' + sig;
}

async function verifyPortalToken(token: string): Promise<PortalPayload | null> {
  if (!token.startsWith(PREFIX)) return null;
  const rest = token.slice(PREFIX.length);
  const dot = rest.lastIndexOf('.');
  if (dot < 1) return null;
  const payloadB64 = rest.slice(0, dot);
  const sig = rest.slice(dot + 1);
  if (!(await hmacVerify(payloadB64, sig))) return null;
  try {
    const payload = JSON.parse(atob(payloadB64)) as PortalPayload;
    if (!payload.u || !payload.r || !payload.o || !payload.e) return null;
    if (Date.now() > payload.e) return null;
    return payload;
  } catch {
    return null;
  }
}



const TRUE_VALUE_FIELDS = new Set([
  'true_margin',
  'true_quote_price',
  'true_value_addition',
  'true_value_updated_at',
  'true_value_updated_by',
]);

const FINAL_SNAPSHOT_FIELDS = new Set([
  'status',
  'exported_at',
  'calc_margin',
  'calc_quote_price',
  'calc_value_addition',
  'current_step',
]);

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
    return { ...member, username: member.email, email: member.email };
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

function isFinalLockedStatus(status: string) {
  return status === 'final' || status === 'sent' || status === 'approved';
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

async function loadCommentsForCostings(costingIds: string[]) {
  if (!costingIds.length) return {} as Record<string, unknown[]>;
  const db = adminClient();
  const { data } = await db
    .from('sahasra_costing_comments')
    .select('id, costing_id, author, body, is_flag, created_at')
    .in('costing_id', costingIds)
    .order('created_at', { ascending: false });
  const map: Record<string, unknown[]> = {};
  for (const row of data || []) {
    if (!map[row.costing_id]) map[row.costing_id] = [];
    map[row.costing_id].push(row);
  }
  return map;
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
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(200);
      if (status) q = q.eq('status', status);
      if (member.role !== 'admin') {
        q = q.eq('created_by', actor);
      }
      const { data, error } = await q;
      if (error) throw error;
      const rows = data || [];
      const commentsMap = await loadCommentsForCostings(rows.map((r) => r.id));
      const costings = rows.map((r) => ({
        ...r,
        comments: commentsMap[r.id] || [],
        flag_count: (commentsMap[r.id] || []).filter((c) => (c as { is_flag?: boolean }).is_flag)
          .length,
      }));
      return jsonResponse(200, { costings });
    }

    if (req.method === 'GET' && op === 'costing' && id) {
      const { data, error } = await db
        .from('sahasra_costings')
        .select('*')
        .eq('id', id)
        .eq('org_id', member.org_id)
        .is('deleted_at', null)
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
      const { data: comments } = await db
        .from('sahasra_costing_comments')
        .select('id, costing_id, author, body, is_flag, created_at')
        .eq('costing_id', id)
        .order('created_at', { ascending: false })
        .limit(100);
      return jsonResponse(200, {
        costing: data,
        audit: audit || [],
        comments: comments || [],
      });
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
        .is('deleted_at', null)
        .maybeSingle();
      if (fetchErr) throw fetchErr;
      if (!existing) return jsonResponse(404, { error: 'Costing not found' });
      if (member.role !== 'admin' && existing.created_by !== actor) {
        return jsonResponse(403, { error: 'Access denied' });
      }

      let body: Record<string, unknown> = {};
      try {
        body = await req.json();
      } catch {
        body = {};
      }
      const patch = pickCostingPatch(body);

      // Non-admins: final costings only allow true-value fields (+ reopen blocked).
      if (isFinalLockedStatus(existing.status) && member.role !== 'admin') {
        const keys = Object.keys(patch);
        const illegal = keys.filter(
          (k) => !TRUE_VALUE_FIELDS.has(k) && !FINAL_SNAPSHOT_FIELDS.has(k),
        );
        // Allow status reopen only for admin; non-admin cannot change away from final except true values.
        if (patch.status && patch.status !== existing.status && patch.status !== 'final') {
          return jsonResponse(403, { error: 'This costing is locked. Only true values can be edited.' });
        }
        if (illegal.length) {
          return jsonResponse(403, {
            error: 'This costing is locked. Only true values can be edited.',
          });
        }
      }

      if (Object.prototype.hasOwnProperty.call(patch, 'true_margin') ||
        Object.prototype.hasOwnProperty.call(patch, 'true_quote_price') ||
        Object.prototype.hasOwnProperty.call(patch, 'true_value_addition')) {
        patch.true_value_updated_at = new Date().toISOString();
        patch.true_value_updated_by = actor;
      }

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

    if (req.method === 'DELETE' && op === 'costing' && id) {
      const { data: existing, error: fetchErr } = await db
        .from('sahasra_costings')
        .select('*')
        .eq('id', id)
        .eq('org_id', member.org_id)
        .is('deleted_at', null)
        .maybeSingle();
      if (fetchErr) throw fetchErr;
      if (!existing) return jsonResponse(404, { error: 'Costing not found' });
      if (member.role !== 'admin' && existing.created_by !== actor) {
        return jsonResponse(403, { error: 'Access denied' });
      }
      const now = new Date().toISOString();
      const { error } = await db
        .from('sahasra_costings')
        .update({ deleted_at: now, updated_by: actor, updated_at: now })
        .eq('id', id);
      if (error) throw error;
      await writeAudit(id, actor, 'deleted', existing.status, 'deleted');
      return jsonResponse(200, { ok: true });
    }

    if (req.method === 'GET' && op === 'comments' && id) {
      const { data: existing } = await db
        .from('sahasra_costings')
        .select('id, created_by, org_id')
        .eq('id', id)
        .eq('org_id', member.org_id)
        .is('deleted_at', null)
        .maybeSingle();
      if (!existing) return jsonResponse(404, { error: 'Costing not found' });
      if (member.role !== 'admin' && existing.created_by !== actor) {
        return jsonResponse(403, { error: 'Access denied' });
      }
      const { data: comments } = await db
        .from('sahasra_costing_comments')
        .select('id, costing_id, author, body, is_flag, created_at')
        .eq('costing_id', id)
        .order('created_at', { ascending: false });
      return jsonResponse(200, { comments: comments || [] });
    }

    if (req.method === 'POST' && op === 'comment' && id) {
      assertRole(member, ['admin']);
      const { data: existing } = await db
        .from('sahasra_costings')
        .select('id, org_id')
        .eq('id', id)
        .eq('org_id', member.org_id)
        .is('deleted_at', null)
        .maybeSingle();
      if (!existing) return jsonResponse(404, { error: 'Costing not found' });
      let body: Record<string, unknown> = {};
      try {
        body = await req.json();
      } catch {
        body = {};
      }
      const text = String(body.body || '').trim();
      if (!text) return jsonResponse(400, { error: 'Comment body is required' });
      const isFlag = Boolean(body.is_flag);
      const { data, error } = await db
        .from('sahasra_costing_comments')
        .insert({
          costing_id: id,
          author: actor,
          body: text,
          is_flag: isFlag,
        })
        .select('*')
        .single();
      if (error) throw error;
      await writeAudit(id, actor, isFlag ? 'flag' : 'comment', null, text);
      return jsonResponse(201, { comment: data });
    }

    if (req.method === 'GET' && op === 'dashboard') {
      assertRole(member, ['admin']);
      // Full rows so Leadership can live-compute missing calc_* (matches Costings list).
      const { data, error } = await db
        .from('sahasra_costings')
        .select('*')
        .eq('org_id', member.org_id)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      const rows = data || [];
      const byStatus: Record<string, number> = {};
      const byCreator: Record<string, number> = {};
      for (const r of rows) {
        byStatus[r.status] = (byStatus[r.status] || 0) + 1;
        byCreator[r.created_by] = (byCreator[r.created_by] || 0) + 1;
      }
      // All non-deleted costings — same population as Costings filters / PM cards.
      const PM_PROFILES = ['Sahasra_1', 'Sahasra_2', 'Sahasra_3', 'Sahasra_4', 'Sahasra_5'];
      const chartRows = rows;
      const byPmCount: Record<string, number> = {};
      for (const pm of PM_PROFILES) byPmCount[pm] = 0;
      for (const r of chartRows) {
        if (PM_PROFILES.includes(r.created_by)) {
          byPmCount[r.created_by] = (byPmCount[r.created_by] || 0) + 1;
        }
      }
      const { data: recentAudit } = await db
        .from('sahasra_audit_log')
        .select('id, costing_id, user_email, field_name, old_value, new_value, changed_at')
        .order('changed_at', { ascending: false })
        .limit(100);
      const commentsMap = await loadCommentsForCostings(rows.map((r) => r.id));
      const recent_costings = rows.slice(0, 50).map((r) => ({
        ...r,
        comments: commentsMap[r.id] || [],
        flag_count: (commentsMap[r.id] || []).filter((c) => (c as { is_flag?: boolean }).is_flag)
          .length,
      }));
      return jsonResponse(200, {
        summary: {
          total: rows.length,
          by_status: byStatus,
          by_creator: byCreator,
          by_pm_final: byPmCount,
          by_pm_count: byPmCount,
        },
        recent_costings,
        chart_rows: chartRows,
        recent_activity: recentAudit || [],
      });
    }

    if (req.method === 'GET' && op === 'history') {
      assertRole(member, ['admin']);
      const { data: recentAudit } = await db
        .from('sahasra_audit_log')
        .select('id, costing_id, user_email, field_name, old_value, new_value, changed_at')
        .order('changed_at', { ascending: false })
        .limit(200);
      return jsonResponse(200, { activity: recentAudit || [] });
    }

    return jsonResponse(404, { error: 'Unknown operation' });
  } catch (err) {
    const status = (err as Error & { status?: number }).status ?? 500;
    return jsonResponse(status, {
      error: err instanceof Error ? err.message : 'Server error',
    });
  }
});
