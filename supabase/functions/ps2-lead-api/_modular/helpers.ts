import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

// ── Inlined shared helpers ────────────────────────────────────────────────────
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
};
export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
export function optionsResponse(): Response {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export const TOKEN_PREFIX = 'sp1.';
export type PortalPayload = { u: string; r: string; o: string; e: number };
function _secretKey(): string {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!key) throw new Error('Service role key not configured');
  return key;
}
async function _hmacSign(message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(_secretKey()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}
export async function signPortalToken(input: { username: string; role: string; org_id: string }): Promise<string> {
  const payload = btoa(JSON.stringify({ u: input.username, r: input.role, o: input.org_id, e: Date.now() + 7 * 24 * 60 * 60 * 1000 } satisfies PortalPayload));
  const sig = await _hmacSign(payload);
  return TOKEN_PREFIX + payload + '.' + sig;
}
export async function verifyPortalToken(token: string): Promise<PortalPayload | null> {
  if (!token.startsWith(TOKEN_PREFIX)) return null;
  const rest = token.slice(TOKEN_PREFIX.length);
  const dot = rest.lastIndexOf('.');
  if (dot < 1) return null;
  const payloadB64 = rest.slice(0, dot);
  const sig = rest.slice(dot + 1);
  if ((await _hmacSign(payloadB64)) !== sig) return null;
  try {
    const p = JSON.parse(atob(payloadB64)) as PortalPayload;
    if (!p.u || !p.r || !p.o || !p.e) return null;
    if (Date.now() > p.e) return null;
    return p;
  } catch { return null; }
}

// ─── DB client ────────────────────────────────────────────────────────────────
export function db() {
  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(url, key, { auth: { persistSession: false } });
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const ORG_ID = 'b1c2d3e4-f5a6-7890-abcd-ef1234567890';

export type SessionUser = {
  id: string;
  username: string;
  full_name: string | null;
  role: 'sahasra_admin' | 'sahasra_employee' | 'pt_admin';
  organization_id: string;
  outlook_account: string | null;
};

export function bearerToken(req: Request): string | null {
  const h = req.headers.get('authorization') || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : null;
}

export function n8nApiKey(req: Request): string | null {
  return req.headers.get('x-api-key');
}

// N8N service actor (used for n8n API-key auth)
export const N8N_ACTOR: SessionUser = {
  id: 'c2d3e4f5-a6b7-8901-bcde-f12345678901',
  username: 'n8n-service',
  full_name: 'n8n automation',
  role: 'sahasra_admin',
  organization_id: ORG_ID,
  outlook_account: null,
};

export async function resolveUser(req: Request): Promise<SessionUser | null> {
  // n8n API key (Edge secret preferred; DB fallback so handshake can land without CLI)
  const apiKey = n8nApiKey(req);
  if (apiKey) {
    const expected = await getN8nApiKey();
    if (expected && apiKey === expected) return N8N_ACTOR;
  }

  // Portal JWT token
  const token = bearerToken(req);
  if (!token) return null;
  const payload = await verifyPortalToken(token);
  if (!payload) return null;

  const { data } = await db()
    .from('ps2_users')
    .select('id, username, full_name, role, organization_id, outlook_account')
    .eq('username', payload.u)
    .eq('organization_id', ORG_ID)
    .eq('is_active', true)
    .maybeSingle();

  if (!data) return null;
  return data as SessionUser;
}

export function unauthorized() { return jsonResponse(401, { ok: false, error: 'Sign in required' }); }
export function forbidden(msg = 'Access denied') { return jsonResponse(403, { ok: false, error: msg }); }

// ─── Helpers ──────────────────────────────────────────────────────────────────
export const SENT_STATUSES = [
  'mail_1_sent','follow_up_1','follow_up_2','follow_up_3','follow_up_4','follow_up_5',
  'follow_up_6','follow_up_7','follow_up_8','follow_up_9','follow_up_10',
];

export async function logActivity(
  actorId: string | null,
  entityType: string,
  entityId: string | null,
  action: string,
  summary: string,
) {
  await db().from('ps2_activity_log').insert({
    organization_id: ORG_ID,
    actor_id: actorId,
    entity_type: entityType,
    entity_id: entityId,
    action,
    summary,
  });
}

export type Webhooks = {
  send_email: string;
  sync_sheets: string;
  process_replies: string;
  enrich_website: string;
  extract_pdf: string;
};

export async function getWebhooks(): Promise<Webhooks> {
  const { data } = await db()
    .from('ps2_system_settings')
    .select('value').eq('organization_id', ORG_ID).eq('key', 'n8n_webhooks').maybeSingle();
  const v = (data?.value as Record<string, string>) || {};
  return {
    send_email: v.send_email || '',
    sync_sheets: v.sync_sheets || '',
    process_replies: v.process_replies || '',
    enrich_website: v.enrich_website || '',
    extract_pdf: v.extract_pdf || '',
  };
}

export async function getN8nApiKey(): Promise<string> {
  const envKey = Deno.env.get('N8N_API_KEY') || '';
  if (envKey) return envKey;
  const { data } = await db()
    .from('ps2_system_settings')
    .select('value').eq('organization_id', ORG_ID).eq('key', 'n8n_api_key').maybeSingle();
  const v = data?.value as Record<string, string> | string | null;
  if (!v) return '';
  if (typeof v === 'string') return v;
  return v.key || '';
}

export function fireN8n(url: string, body: unknown, apiKey: string) {
  if (!url) return;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) {
    // Handshake standard is x-api-key. Also send Shreyas09 until n8n webhook
    // Header Auth credential is renamed to match the handshake.
    headers['x-api-key'] = apiKey;
    headers['Shreyas09'] = apiKey;
  }
  fetch(url, { method: 'POST', headers, body: JSON.stringify(body) }).catch(() => { /* fire and forget */ });
}

export function leadRowFromBody(
  body: Record<string, unknown>,
  source: string,
  extra: Record<string, unknown> = {},
) {
  const first = (body.first_name as string) || null;
  const last = (body.last_name as string) || null;
  const full = (body.full_name as string)
    || [first, last].filter(Boolean).join(' ')
    || null;
  return {
    organization_id: ORG_ID,
    first_name: first,
    last_name: last,
    full_name: full,
    company: body.company || null,
    designation: body.designation || null,
    email: body.email ? String(body.email).trim() : null,
    phone: body.phone || null,
    website: body.website || null,
    source,
    assigned_to: body.assigned_to || null,
    tags: body.tags || [],
    custom_intro: body.custom_intro || null,
    notes: body.notes || null,
    status: 'new',
    last_activity_at: new Date().toISOString(),
    ...extra,
  };
}

export const FOLLOW_UP_STATUSES = Array.from({ length: 10 }, (_, i) => `follow_up_${i + 1}`);
export const MAIL1_OR_LATER = [
  'mail_1_sent', ...FOLLOW_UP_STATUSES, 'responded', 'meeting_scheduled', 'converted',
];

