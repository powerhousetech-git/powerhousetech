import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

// ── Inlined shared helpers ────────────────────────────────────────────────────
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
};
function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
function optionsResponse(): Response {
  return new Response(null, { status: 204, headers: corsHeaders });
}

const TOKEN_PREFIX = 'sp1.';
type PortalPayload = { u: string; r: string; o: string; e: number };
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
async function signPortalToken(input: { username: string; role: string; org_id: string }): Promise<string> {
  const payload = btoa(JSON.stringify({ u: input.username, r: input.role, o: input.org_id, e: Date.now() + 7 * 24 * 60 * 60 * 1000 } satisfies PortalPayload));
  const sig = await _hmacSign(payload);
  return TOKEN_PREFIX + payload + '.' + sig;
}
async function verifyPortalToken(token: string): Promise<PortalPayload | null> {
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
function db() {
  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(url, key, { auth: { persistSession: false } });
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
const ORG_ID = 'b1c2d3e4-f5a6-7890-abcd-ef1234567890';

type SessionUser = {
  id: string;
  username: string;
  full_name: string | null;
  role: 'sahasra_admin' | 'sahasra_employee' | 'pt_admin';
  organization_id: string;
  outlook_account: string | null;
};

function bearerToken(req: Request): string | null {
  const h = req.headers.get('authorization') || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : null;
}

function n8nApiKey(req: Request): string | null {
  return req.headers.get('x-api-key');
}

// N8N service actor (used for n8n API-key auth)
const N8N_ACTOR: SessionUser = {
  id: 'c2d3e4f5-a6b7-8901-bcde-f12345678901',
  username: 'n8n-service',
  full_name: 'n8n automation',
  role: 'sahasra_admin',
  organization_id: ORG_ID,
  outlook_account: null,
};

async function resolveUser(req: Request): Promise<SessionUser | null> {
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

function unauthorized() { return jsonResponse(401, { ok: false, error: 'Sign in required' }); }
function forbidden(msg = 'Access denied') { return jsonResponse(403, { ok: false, error: msg }); }

// ─── Helpers ──────────────────────────────────────────────────────────────────
const SENT_STATUSES = [
  'mail_1_sent','follow_up_1','follow_up_2','follow_up_3','follow_up_4','follow_up_5',
  'follow_up_6','follow_up_7','follow_up_8','follow_up_9','follow_up_10',
];

async function logActivity(
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

type Webhooks = {
  send_email: string;
  sync_sheets: string;
  process_replies: string;
  enrich_website: string;
  extract_pdf: string;
  add_lead: string;
  update_lead: string;
};

const MASTER_SHEET_ID = '1UxKqqC5unE3CwTMqgpB3SMARfxIIw2sVSZQUuz3SclU';
const MASTER_SHEET_GID = '0';
const N8N_BASE_DEFAULT = 'https://shreyas-sinha.app.n8n.cloud';

async function getWebhooks(): Promise<Webhooks> {
  const { data } = await db()
    .from('ps2_system_settings')
    .select('value').eq('organization_id', ORG_ID).eq('key', 'n8n_webhooks').maybeSingle();
  const v = (data?.value as Record<string, string>) || {};
  return {
    send_email: v.send_email || `${N8N_BASE_DEFAULT}/webhook/ps2-send-email`,
    sync_sheets: v.sync_sheets || `${N8N_BASE_DEFAULT}/webhook/ps2-sync-sheets`,
    process_replies: v.process_replies || `${N8N_BASE_DEFAULT}/webhook/ps2-process-replies`,
    enrich_website: v.enrich_website || `${N8N_BASE_DEFAULT}/webhook/ps2-website-enrichment`,
    extract_pdf: v.extract_pdf || '',
    add_lead: v.add_lead || `${N8N_BASE_DEFAULT}/webhook/ps2-add-lead`,
    update_lead: v.update_lead || `${N8N_BASE_DEFAULT}/webhook/ps2-update-lead`,
  };
}

/** Minimal CSV parser (handles quoted fields). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',' || c === '\t') { row.push(cur); cur = ''; }
      else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else if (c !== '\r') cur += c;
    }
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((x) => String(x).trim()));
}

function headerKey(h: string): string {
  return String(h || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function mapSheetRow(headers: string[], cells: string[], rowNumber: number) {
  const idx: Record<string, number> = {};
  headers.forEach((h, i) => { idx[headerKey(h)] = i; });
  const get = (...aliases: string[]) => {
    for (const a of aliases) {
      const i = idx[headerKey(a)];
      if (i != null && cells[i] != null && String(cells[i]).trim()) {
        const v = String(cells[i]).trim();
        if (/^#ERROR!?$/i.test(v) || v === '#N/A' || v === '#REF!') return '';
        return v;
      }
    }
    return '';
  };
  const email = get('Email', 'E-mail', 'Mail');
  const name = get('Name', 'Full Name', 'FullName', 'Contact');
  const statusRaw = get('Status', 'Pipeline Status') || 'new';
  const status = statusRaw.toLowerCase().replace(/\s+/g, '_');
  const fuRaw = get('Follow Up Count', 'Follow-Up Count', 'FollowUpCount', 'FU Count');
  const follow_up_count = fuRaw === '' ? 0 : Number(fuRaw) || 0;
  return {
    id: email || `row-${rowNumber}`,
    row_number: rowNumber,
    full_name: name,
    name,
    email,
    phone: get('Phone', 'Mobile', 'Tel'),
    company: get('Company', 'Organisation', 'Organization'),
    designation: get('Designation', 'Title', 'Job Title'),
    website: get('Website', 'URL', 'Web'),
    source: get('Source') || 'manual',
    status,
    follow_up_count,
    website_summary: get('Website Summary', 'WebsiteSummary', 'Summary'),
    last_email_sent: get('Last Email Sent', 'LastEmailSent', 'Last Email'),
    created_at: get('Created At', 'CreatedAt', 'Created'),
    notes: get('Notes', 'Note', 'Comments'),
    last_activity_at: get('Last Email Sent', 'Created At') || null,
  };
}

async function getN8nApiKey(): Promise<string> {
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

function n8nHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) {
    // Handshake standard is x-api-key. Also send Shreyas09 until n8n webhook
    // Header Auth credential is renamed to match the handshake.
    headers['x-api-key'] = apiKey;
    headers['Shreyas09'] = apiKey;
  }
  return headers;
}

function fireN8n(url: string, body: unknown, apiKey: string) {
  if (!url) return;
  fetch(url, { method: 'POST', headers: n8nHeaders(apiKey), body: JSON.stringify(body) }).catch(() => { /* fire and forget */ });
}

async function postN8n(url: string, body: unknown, apiKey: string): Promise<boolean> {
  if (!url) return false;
  try {
    const res = await fetch(url, { method: 'POST', headers: n8nHeaders(apiKey), body: JSON.stringify(body) });
    return res.ok;
  } catch {
    return false;
  }
}

type CardContact = {
  name: string;
  email: string;
  phone: string;
  company: string;
  designation: string;
  website: string;
  notes: string;
};

/** Claude vision OCR for business-card PDFs/images when n8n WF-E is not configured. */
async function extractContactsFromCard(contentBase64: string, contentType: string): Promise<CardContact[]> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return [];

  const mime = (contentType || 'application/pdf').split(';')[0].trim().toLowerCase();
  const isPdf = mime.includes('pdf');
  const isImage = mime.startsWith('image/');
  if (!isPdf && !isImage) return [];

  const prompt =
    'Extract every business card / contact visible in this file. ' +
    'Return ONLY a JSON array (no markdown) of objects with keys: ' +
    'name, email, phone, company, designation, website, notes. ' +
    'Use empty string for missing fields. One object per distinct person/card. ' +
    'Prefer the printed personal email on the card. Normalize website to https:// when possible.';

  const userContent: Array<Record<string, unknown>> = [{ type: 'text', text: prompt }];
  if (isPdf) {
    userContent.push({
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: contentBase64 },
    });
  } else {
    userContent.push({
      type: 'image',
      source: { type: 'base64', media_type: mime, data: contentBase64 },
    });
  }

  // Match other PowerhouseTech edge functions (override via ANTHROPIC_MODEL)
  const model = Deno.env.get('ANTHROPIC_MODEL')?.trim() || 'claude-opus-4-8';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  };
  if (isPdf) headers['anthropic-beta'] = 'pdfs-2024-09-25';

  async function callAnthropic(activeModel: string) {
    return await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: activeModel,
        max_tokens: 2500,
        messages: [{ role: 'user', content: userContent }],
      }),
    });
  }

  let res = await callAnthropic(model);
  // Fallback chain if pinned model slug 404s on this account
  if (res.status === 404) {
    for (const fallback of ['claude-sonnet-4-5', 'claude-sonnet-4-20250514', 'claude-3-5-sonnet-latest']) {
      if (fallback === model) continue;
      console.error('card OCR retry with model', fallback);
      res = await callAnthropic(fallback);
      if (res.ok || res.status !== 404) break;
    }
  }
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error('card OCR anthropic error', res.status, errText.slice(0, 400));
    throw new Error(`Card OCR failed (Anthropic HTTP ${res.status})`);
  }
  const data = await res.json() as { content?: Array<{ type?: string; text?: string }> };
  const text = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text || '').join('\n').trim();
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(match[0]); } catch { return []; }
  if (!Array.isArray(parsed)) return [];
  return parsed.map((raw) => {
    const o = (raw || {}) as Record<string, unknown>;
    const str = (k: string) => String(o[k] ?? '').trim();
    let website = str('website');
    if (website && !/^https?:\/\//i.test(website)) website = 'https://' + website.replace(/^\/\//, '');
    return {
      name: str('name') || str('full_name'),
      email: str('email').toLowerCase(),
      phone: str('phone'),
      company: str('company'),
      designation: str('designation') || str('title'),
      website,
      notes: str('notes'),
    };
  }).filter((c) => c.name || c.email || c.company);
}

function leadRowFromBody(
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

const FOLLOW_UP_STATUSES = Array.from({ length: 10 }, (_, i) => `follow_up_${i + 1}`);
const MAIL1_OR_LATER = [
  'mail_1_sent', ...FOLLOW_UP_STATUSES, 'responded', 'meeting_scheduled', 'converted',
];

// ─── Main handler ─────────────────────────────────────────────────────────────
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
    // Falls back to ps2_users pgcrypto verify
    if (error || !data?.[0]) {
      // Try ps2_users directly via bcrypt — delegate to a separate RPC or check manually
      const { data: user } = await db()
        .from('ps2_users')
        .select('id, username, password_hash, full_name, role, organization_id, outlook_account')
        .eq('username', username)
        .eq('organization_id', ORG_ID)
        .eq('is_active', true)
        .maybeSingle();
      if (!user) return jsonResponse(401, { ok: false, error: 'Invalid credentials' });

      // Verify via pgcrypto function for ps2 users
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

  // ── All other ops require auth ─────────────────────────────────────────────
  const user = await resolveUser(req);
  if (!user) return unauthorized();

  // pt_admin can only access settings/system op
  if (user.role === 'pt_admin' && !['settings', 'system-settings'].includes(op)) {
    return forbidden('pt_admin can only access system settings');
  }

  const isN8n = user.username === N8N_ACTOR.username;

  try {

    // ── ME ──────────────────────────────────────────────────────────────────
    if (op === 'me' && method === 'GET') {
      return jsonResponse(200, { ok: true, user });
    }

    // ── DASHBOARD STATS ─────────────────────────────────────────────────────
    if (op === 'stats' && method === 'GET') {
      const { data: leads } = await db()
        .from('ps2_leads').select('status').eq('organization_id', ORG_ID);
      const all = leads || [];
      const total = all.length;
      const byStatus = Object.fromEntries(
        ['new','mail_1_sent','responded','meeting_scheduled','converted','discarded']
          .map(s => [s, all.filter(l => l.status === s).length])
      );
      const sent = all.filter(l => SENT_STATUSES.includes(l.status)).length;
      const { data: projects } = await db()
        .from('ps2_client_projects').select('stage').eq('organization_id', ORG_ID);
      const { data: emails } = await db()
        .from('ps2_lead_emails').select('sequence_step, status, direction, lead_id');
      const sentOut = (emails || []).filter(e => e.direction === 'outbound' && e.status === 'sent');
      const mail1FromEmail = new Set(sentOut.filter(e => e.sequence_step === 1).map(e => e.lead_id)).size;
      const followFromEmail = sentOut.filter(e => (e.sequence_step || 0) >= 2).length;
      const inboundCount = (emails || []).filter(e => e.direction === 'inbound').length;
      const mail1FromStatus = all.filter(l => MAIL1_OR_LATER.includes(l.status)).length;
      const followFromStatus = all.filter(l => FOLLOW_UP_STATUSES.includes(l.status)).length;
      const responsesFromStatus = (byStatus['responded'] || 0)
        + (byStatus['meeting_scheduled'] || 0)
        + (byStatus['converted'] || 0);
      const contacted = all.filter(l => l.status !== 'new').length;
      const converted = byStatus['converted'] || 0;
      const conversionRate = contacted > 0
        ? Math.round((converted / contacted) * 1000) / 10
        : 0;
      return jsonResponse(200, {
        ok: true,
        data: {
          total_leads: total,
          new_leads: byStatus['new'] || 0,
          sent_leads: sent,
          mail_1_sent: mail1FromEmail || mail1FromStatus,
          follow_ups_sent: followFromEmail || followFromStatus,
          responded_leads: inboundCount || (byStatus['responded'] || 0),
          responses: inboundCount || responsesFromStatus,
          meetings_scheduled: byStatus['meeting_scheduled'] || 0,
          converted_leads: converted,
          discarded_leads: byStatus['discarded'] || 0,
          contacted_leads: contacted,
          conversion_rate: conversionRate,
          active_projects: (projects || []).filter(p => !['completed','on_hold'].includes(p.stage)).length,
          funnel: [
            { status: 'new', label: 'New', count: byStatus['new'] || 0 },
            { status: 'sent', label: 'Mail 1 / Follow-up', count: (mail1FromEmail || mail1FromStatus) },
            { status: 'responded', label: 'Responded', count: inboundCount || responsesFromStatus },
            { status: 'meeting', label: 'Meeting', count: byStatus['meeting_scheduled'] || 0 },
            { status: 'converted', label: 'Converted', count: converted },
          ],
        },
      });
    }

    // ── ACTIVITY ─────────────────────────────────────────────────────────────
    if (op === 'activity' && method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const { data } = await db()
        .from('ps2_activity_log')
        .select('*')
        .eq('organization_id', ORG_ID)
        .order('created_at', { ascending: false })
        .limit(limit);
      return jsonResponse(200, { ok: true, data: data || [] });
    }

    // ── LEADS LIST ───────────────────────────────────────────────────────────
    if (op === 'leads' && method === 'GET') {
      const status = url.searchParams.get('status');
      const source = url.searchParams.get('source');
      const assignedTo = url.searchParams.get('assigned_to');
      const search = url.searchParams.get('search');
      const page = parseInt(url.searchParams.get('page') || '1');
      const pageSize = parseInt(url.searchParams.get('pageSize') || '50');

      let q = db().from('ps2_leads').select('*, ps2_users!assigned_to(full_name, outlook_account)', { count: 'exact' })
        .eq('organization_id', ORG_ID)
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (status) q = q.eq('status', status);
      if (source) q = q.eq('source', source);
      if (assignedTo) q = q.eq('assigned_to', assignedTo);
      if (search) q = q.or(`full_name.ilike.%${search}%,company.ilike.%${search}%,email.ilike.%${search}%`);

      const { data, count, error } = await q;
      if (error) throw error;
      return jsonResponse(200, { ok: true, data: { leads: data || [], total: count || 0, page, pageSize } });
    }

    // ── LEADS READY TO SEND (n8n workflow A) ─────────────────────────────────
    if (op === 'leads-ready-to-send' && method === 'GET') {
      // Get active mail config steps
      const { data: steps } = await db()
        .from('ps2_mail_sequence_config')
        .select('*')
        .eq('organization_id', ORG_ID)
        .eq('is_active', true)
        .order('step_number');

      const now = new Date();
      const { data: leads } = await db()
        .from('ps2_leads')
        .select('*, ps2_users!assigned_to(full_name, outlook_account)')
        .eq('organization_id', ORG_ID)
        .not('status', 'in', '("responded","meeting_scheduled","converted","discarded")')
        .not('email', 'is', null);

      const ready = (leads || []).filter(lead => {
        const lastActivity = lead.last_activity_at ? new Date(lead.last_activity_at) : new Date(lead.created_at);
        const daysSince = (now.getTime() - lastActivity.getTime()) / 86400000;

        if (lead.status === 'new') return true; // Ready for mail 1

        // Find current step number
        const statusToStep: Record<string, number> = { mail_1_sent: 1 };
        for (let i = 1; i <= 10; i++) statusToStep[`follow_up_${i}`] = i + 1;
        const currentStepNum = statusToStep[lead.status];
        if (!currentStepNum) return false;

        const nextStep = (steps || []).find(s => s.step_number === currentStepNum + 1);
        if (!nextStep) return false;
        return daysSince >= nextStep.day_offset;
      });

      // Attach the template for the next step
      const enriched = ready.map(lead => {
        let nextStepNum = 1;
        if (lead.status !== 'new') {
          const statusToStep: Record<string, number> = { mail_1_sent: 1 };
          for (let i = 1; i <= 10; i++) statusToStep[`follow_up_${i}`] = i + 1;
          nextStepNum = (statusToStep[lead.status] || 0) + 1;
        }
        const step = (steps || []).find(s => s.step_number === nextStepNum);
        return {
          ...lead,
          next_step: step || null,
          assigned_outlook: (lead as Record<string,unknown>)['ps2_users']
            ? ((lead as Record<string,unknown>)['ps2_users'] as Record<string,unknown>)['outlook_account']
            : null,
        };
      });

      return jsonResponse(200, { ok: true, data: { leads: enriched, total: enriched.length } });
    }

    // ── SINGLE LEAD ──────────────────────────────────────────────────────────
    if (op === 'lead' && id && method === 'GET') {
      const { data, error } = await db()
        .from('ps2_leads').select('*').eq('id', id).eq('organization_id', ORG_ID).maybeSingle();
      if (error) throw error;
      if (!data) return jsonResponse(404, { ok: false, error: 'Lead not found' });
      return jsonResponse(200, { ok: true, data: { lead: data } });
    }

    if (op === 'lead-by-email' && method === 'GET') {
      const email = (url.searchParams.get('email') || '').trim().toLowerCase();
      if (!email) return jsonResponse(400, { ok: false, error: 'email required' });
      const { data, error } = await db()
        .from('ps2_leads').select('*').eq('organization_id', ORG_ID).ilike('email', email).maybeSingle();
      if (error) throw error;
      if (!data) return jsonResponse(404, { ok: false, error: 'Lead not found' });
      return jsonResponse(200, { ok: true, data: { lead: data } });
    }

    // ── CREATE LEAD ──────────────────────────────────────────────────────────
    if (op === 'lead' && method === 'POST') {
      if (user.role === 'pt_admin') return forbidden();
      let body: Record<string, unknown> = {};
      try { body = await req.json(); } catch { /* */ }
      const source = String(body.source || 'manual');
      const fullName = String(body.full_name || [body.first_name, body.last_name].filter(Boolean).join(' ') || '').trim();
      const email = body.email ? String(body.email).trim() : '';
      const company = body.company ? String(body.company).trim() : '';
      // Manual / single-row creates require a name and either email or company
      if (source === 'manual' || !Array.isArray((body as { leads?: unknown }).leads)) {
        if (!fullName) return jsonResponse(400, { ok: false, error: 'full_name is required' });
        if (!email && !company) {
          return jsonResponse(400, { ok: false, error: 'email or company is required' });
        }
      }
      const row = leadRowFromBody(body, source);
      const { data, error } = await db().from('ps2_leads').insert(row).select('*').single();
      if (error) throw error;
      await logActivity(user.id, 'lead', data.id, 'lead_created', `New lead: ${data.full_name || data.email} (${data.company})`);
      if (data.website) {
        const [wh, key] = await Promise.all([getWebhooks(), getN8nApiKey()]);
        fireN8n(wh.enrich_website, { event: 'lead.created', lead_id: data.id, website: data.website }, key);
      }
      return jsonResponse(201, { ok: true, data: { lead: data } });
    }

    // ── PATCH LEAD ───────────────────────────────────────────────────────────
    if (op === 'lead' && id && method === 'PATCH') {
      if (user.role === 'pt_admin') return forbidden();
      let body: Record<string, unknown> = {};
      try { body = await req.json(); } catch { /* */ }
      const allowed = ['first_name','last_name','full_name','company','designation','email','phone',
        'website','website_summary','status','assigned_to','tags','custom_intro','notes',
        'meeting_scheduled_at','last_activity_at','attachments'];
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const k of allowed) if (Object.prototype.hasOwnProperty.call(body, k)) patch[k] = body[k];
      if (Object.prototype.hasOwnProperty.call(body, 'status')) patch.last_activity_at = new Date().toISOString();

      const { data, error } = await db()
        .from('ps2_leads').update(patch).eq('id', id).eq('organization_id', ORG_ID).select('*').single();
      if (error) throw error;
      if (!data) return jsonResponse(404, { ok: false, error: 'Lead not found' });
      await logActivity(user.id, 'lead', id, 'lead_updated', `Lead updated: ${data.full_name || id}`);
      return jsonResponse(200, { ok: true, data: { lead: data } });
    }

    // ── DELETE LEAD ──────────────────────────────────────────────────────────
    if (op === 'lead' && id && method === 'DELETE') {
      if (user.role !== 'sahasra_admin') return forbidden('Only sahasra_admin can delete leads');
      const { error } = await db()
        .from('ps2_leads').delete().eq('id', id).eq('organization_id', ORG_ID);
      if (error) throw error;
      await logActivity(user.id, 'lead', id, 'lead_deleted', `Lead deleted`);
      return jsonResponse(200, { ok: true });
    }

    // ── BULK LEADS ───────────────────────────────────────────────────────────
    if (op === 'leads-bulk' && method === 'POST') {
      if (user.role === 'pt_admin') return forbidden();
      let body: Record<string, unknown> = {};
      try { body = await req.json(); } catch { /* */ }
      const ids = (body.ids as string[]) || [];
      const action = body.action as string;
      const payload = body.payload as Record<string, unknown> || {};
      if (!ids.length || !action) return jsonResponse(400, { ok: false, error: 'ids and action required' });

      if (action === 'delete') {
        if (user.role !== 'sahasra_admin') return forbidden();
        const { error } = await db().from('ps2_leads').delete().in('id', ids).eq('organization_id', ORG_ID);
        if (error) throw error;
        return jsonResponse(200, { ok: true, data: { affected: ids.length } });
      }
      if (action === 'assign' || action === 'tag') {
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (action === 'assign') patch.assigned_to = payload.assigned_to;
        if (action === 'tag') patch.tags = payload.tags;
        const { error } = await db().from('ps2_leads').update(patch).in('id', ids).eq('organization_id', ORG_ID);
        if (error) throw error;
        return jsonResponse(200, { ok: true, data: { affected: ids.length } });
      }
      return jsonResponse(400, { ok: false, error: 'Unknown action' });
    }

    // ── BULK IMPORT (Excel / Sheets / n8n upsert) ────────────────────────────
    if (op === 'leads-import' && method === 'POST') {
      if (user.role === 'pt_admin') return forbidden();
      let body: Record<string, unknown> = {};
      try { body = await req.json(); } catch { /* */ }
      const incoming = (body.leads as Record<string, unknown>[]) || [];
      const source = String(body.source || 'excel');
      if (!['business_card', 'excel', 'google_sheet', 'manual'].includes(source)) {
        return jsonResponse(400, { ok: false, error: 'Invalid source' });
      }
      if (!incoming.length) return jsonResponse(400, { ok: false, error: 'leads array required' });

      let batchId = (body.batch_id as string) || null;
      if (!batchId) {
        const { data: batch, error: bErr } = await db().from('ps2_upload_batches').insert({
          organization_id: ORG_ID,
          source_type: source,
          filename: body.filename || null,
          total_records: incoming.length,
          imported_count: 0,
          duplicate_count: 0,
          failed_count: 0,
          uploaded_by: user.id,
        }).select('id').single();
        if (bErr) throw bErr;
        batchId = batch.id;
      }

      const emails = incoming
        .map(l => l.email ? String(l.email).trim().toLowerCase() : '')
        .filter(Boolean);
      const { data: existingRows } = emails.length
        ? await db().from('ps2_leads').select('id, email').eq('organization_id', ORG_ID)
        : { data: [] as { id: string; email: string | null }[] };
      const existingByEmail = new Map(
        (existingRows || [])
          .filter(r => r.email)
          .map(r => [String(r.email).trim().toLowerCase(), r]),
      );

      const upsert = body.upsert === true || source === 'google_sheet';
      const toInsert: Record<string, unknown>[] = [];
      const toUpdate: { id: string; row: Record<string, unknown> }[] = [];
      let duplicates = 0;
      let failed = 0;

      for (const item of incoming) {
        const email = item.email ? String(item.email).trim().toLowerCase() : '';
        const full = String(item.full_name || [item.first_name, item.last_name].filter(Boolean).join(' ') || '').trim();
        const company = item.company ? String(item.company).trim() : '';
        // Single-row manual empties: require name + (email or company). Bulk imports stay lenient.
        if (incoming.length === 1 && source === 'manual') {
          if (!full || (!email && !company)) { failed += 1; continue; }
        }
        if (!email && !full && !company && !item.phone) { failed += 1; continue; }
        const hit = email ? existingByEmail.get(email) : undefined;
        if (hit && !upsert) { duplicates += 1; continue; }
        const row = leadRowFromBody(item, source, { upload_batch_id: batchId });
        if (email) row.email = email;
        if (hit && upsert) {
          toUpdate.push({ id: hit.id, row: {
            first_name: row.first_name, last_name: row.last_name, full_name: row.full_name,
            company: row.company, designation: row.designation, phone: row.phone,
            website: row.website, notes: row.notes, custom_intro: row.custom_intro,
            updated_at: new Date().toISOString(),
          }});
        } else {
          toInsert.push(row);
          if (email) existingByEmail.set(email, { id: 'pending', email });
        }
      }

      let imported = 0;
      const created: { id: string; website: string | null }[] = [];
      if (toInsert.length) {
        const { data: inserted, error } = await db().from('ps2_leads').insert(toInsert).select('id, website');
        if (error) throw error;
        imported += (inserted || []).length;
        for (const r of inserted || []) created.push(r);
      }
      for (const u of toUpdate) {
        const { error } = await db().from('ps2_leads').update(u.row).eq('id', u.id).eq('organization_id', ORG_ID);
        if (error) { failed += 1; continue; }
        imported += 1;
      }

      await db().from('ps2_upload_batches').update({
        total_records: incoming.length,
        imported_count: imported,
        duplicate_count: duplicates,
        failed_count: failed,
      }).eq('id', batchId);

      await logActivity(user.id, 'lead', batchId, 'leads_imported',
        `Imported ${imported} leads from ${source} (${duplicates} duplicates, ${failed} failed)`);

      if (created.some(c => c.website)) {
        const [wh, key] = await Promise.all([getWebhooks(), getN8nApiKey()]);
        for (const c of created) {
          if (c.website) fireN8n(wh.enrich_website, { event: 'lead.created', lead_id: c.id, website: c.website }, key);
        }
      }

      return jsonResponse(200, {
        ok: true,
        data: { batch_id: batchId, imported, duplicates, failed, total: incoming.length },
      });
    }

    // ── INGEST FILE (PDF business cards → n8n WF-E OR Claude vision OCR) ─────
    if (op === 'ingest-file' && method === 'POST') {
      if (user.role === 'pt_admin') return forbidden();
      let body: Record<string, unknown> = {};
      try { body = await req.json(); } catch { /* */ }
      const filename = String(body.filename || 'upload.bin');
      const contentType = String(body.content_type || 'application/pdf');
      const contentBase64 = String(body.content_base64 || '');
      if (!contentBase64) return jsonResponse(400, { ok: false, error: 'content_base64 required' });
      if (contentBase64.length > 5_000_000) return jsonResponse(413, { ok: false, error: 'File too large (max ~3.5MB)' });

      const { data: batch, error } = await db().from('ps2_upload_batches').insert({
        organization_id: ORG_ID,
        source_type: 'business_card',
        filename,
        storage_path: contentType,
        total_records: 0,
        imported_count: 0,
        duplicate_count: 0,
        failed_count: 0,
        uploaded_by: user.id,
      }).select('*').single();
      if (error) throw error;

      const [wh, key] = await Promise.all([getWebhooks(), getN8nApiKey()]);
      const forwarded = Boolean(wh.extract_pdf);

      // Preferred path: n8n WF-E when configured
      if (forwarded) {
        fireN8n(wh.extract_pdf, {
          event: 'pdf.uploaded',
          batch_id: batch.id,
          filename,
          content_type: contentType,
          content_base64: contentBase64,
        }, key);
        await logActivity(user.id, 'lead', batch.id, 'file_ingested', `Uploaded ${filename} → n8n extract_pdf`);
        return jsonResponse(200, {
          ok: true,
          data: { batch, forwarded: true, extracted: 0, imported: 0, message: 'Queued for n8n extraction' },
        });
      }

      // Fallback: Claude vision OCR on Edge → write each contact to master sheet via add_lead
      if (!Deno.env.get('ANTHROPIC_API_KEY')) {
        await logActivity(user.id, 'lead', batch.id, 'file_ingested', `Uploaded ${filename} (no OCR path)`);
        return jsonResponse(200, {
          ok: true,
          data: {
            batch,
            forwarded: false,
            extracted: 0,
            imported: 0,
            message: 'Saved but not extracted — set extract_pdf webhook or ANTHROPIC_API_KEY for card OCR.',
          },
        });
      }

      let contacts: CardContact[] = [];
      try {
        contacts = await extractContactsFromCard(contentBase64, contentType);
      } catch (ocrErr) {
        // Table has no notes column — only bump failed_count
        await db().from('ps2_upload_batches').update({
          failed_count: 1,
        }).eq('id', batch.id);
        return jsonResponse(502, {
          ok: false,
          error: ocrErr instanceof Error ? ocrErr.message : 'Card OCR failed',
          data: { batch_id: batch.id },
        });
      }

      let imported = 0;
      let failed = 0;
      const leads: CardContact[] = [];
      for (const c of contacts) {
        if (!c.name && !c.email && !c.company) continue;
        const ok = await postN8n(wh.add_lead, {
          action: 'create',
          event: 'lead.create',
          name: c.name,
          full_name: c.name,
          email: c.email,
          phone: c.phone,
          company: c.company,
          designation: c.designation,
          website: c.website,
          source: 'pdf',
          status: 'new',
          notes: c.notes || `Extracted from ${filename}`,
          batch_id: batch.id,
        }, key);
        if (ok) { imported++; leads.push(c); }
        else failed++;
        if (c.website && c.email && wh.enrich_website) {
          fireN8n(wh.enrich_website, { event: 'lead.created', email: c.email, website: c.website }, key);
        }
      }

      const { data: updatedBatch } = await db().from('ps2_upload_batches').update({
        total_records: contacts.length,
        imported_count: imported,
        failed_count: failed,
      }).eq('id', batch.id).select('*').single();

      await logActivity(
        user.id,
        'lead',
        batch.id,
        'file_ingested',
        `OCR ${filename}: extracted ${contacts.length}, imported ${imported}`,
      );

      return jsonResponse(200, {
        ok: true,
        data: {
          batch: updatedBatch || batch,
          forwarded: false,
          ocr: 'anthropic',
          extracted: contacts.length,
          imported,
          failed,
          leads,
          message: imported
            ? `Extracted ${imported} lead(s) from card → master sheet`
            : (contacts.length
              ? 'Contacts found but sheet write failed — is ps2-add-lead Active?'
              : 'No contacts found on card — try a clearer scan or add manually'),
        },
      });
    }

    // ── LEAD ATTACHMENT (photo / PDF on a specific lead) ─────────────────────
    if (op === 'lead-attachment' && method === 'POST') {
      if (user.role === 'pt_admin') return forbidden();
      let body: Record<string, unknown> = {};
      try { body = await req.json(); } catch { /* */ }
      const leadId = String(body.lead_id || id || '');
      const filename = String(body.filename || 'attachment.bin');
      const contentType = String(body.content_type || 'application/octet-stream');
      const contentBase64 = String(body.content_base64 || '');
      const runOcr = body.run_ocr === true;
      if (!leadId) return jsonResponse(400, { ok: false, error: 'lead_id required' });
      if (!contentBase64) return jsonResponse(400, { ok: false, error: 'content_base64 required' });
      if (contentBase64.length > 5_000_000) return jsonResponse(413, { ok: false, error: 'File too large (max ~3.5MB)' });

      const { data: lead } = await db()
        .from('ps2_leads').select('id, attachments, full_name').eq('id', leadId).eq('organization_id', ORG_ID).maybeSingle();
      if (!lead) return jsonResponse(404, { ok: false, error: 'Lead not found' });

      const attachment = {
        id: crypto.randomUUID(),
        filename,
        content_type: contentType,
        uploaded_at: new Date().toISOString(),
        uploaded_by: user.id,
        size_approx: Math.round(contentBase64.length * 0.75),
        ocr_requested: runOcr,
      };
      const next = [...((lead.attachments as unknown[]) || []), attachment];
      const { data: updated, error } = await db().from('ps2_leads').update({
        attachments: next,
        updated_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
      }).eq('id', leadId).select('*').single();
      if (error) throw error;

      const [wh, key] = await Promise.all([getWebhooks(), getN8nApiKey()]);
      let forwarded = false;
      if (runOcr && wh.extract_pdf) {
        forwarded = true;
        fireN8n(wh.extract_pdf, {
          event: 'lead.attachment',
          lead_id: leadId,
          attachment_id: attachment.id,
          filename,
          content_type: contentType,
          content_base64: contentBase64,
        }, key);
      }
      await logActivity(user.id, 'lead', leadId, 'attachment_added', `Attached ${filename} to ${lead.full_name || leadId}`);
      return jsonResponse(200, {
        ok: true,
        data: {
          lead: updated,
          attachment,
          forwarded,
          message: forwarded
            ? 'Attached and queued for OCR'
            : (runOcr ? 'Attached. OCR webhook (extract_pdf / WF-E) not configured yet.' : 'Attached to lead'),
        },
      });
    }

    // ── UPLOAD BATCHES ────────────────────────────────────────────────────────
    if (op === 'upload-batches' && method === 'GET') {
      const { data, error } = await db().from('ps2_upload_batches')
        .select('*').eq('organization_id', ORG_ID)
        .order('created_at', { ascending: false }).limit(30);
      if (error) throw error;
      return jsonResponse(200, { ok: true, data: data || [] });
    }

    // ── TRIGGER N8N (portal "Run now" buttons → n8n webhooks) ────────────────
    if (op === 'trigger-n8n' && method === 'POST') {
      if (user.role === 'pt_admin') return forbidden();
      let body: Record<string, unknown> = {};
      try { body = await req.json(); } catch { /* */ }
      const which = String(body.workflow || body.which || '');
      const allowed: Record<string, keyof Webhooks> = {
        send_email: 'send_email',
        process_replies: 'process_replies',
        sync_sheets: 'sync_sheets',
        enrich_website: 'enrich_website',
        extract_pdf: 'extract_pdf',
        add_lead: 'add_lead',
        update_lead: 'update_lead',
      };
      const key = allowed[which];
      if (!key) {
        return jsonResponse(400, {
          ok: false,
          error: 'workflow must be one of: send_email, process_replies, sync_sheets, enrich_website, extract_pdf, add_lead, update_lead',
        });
      }
      const [wh, apiKey] = await Promise.all([getWebhooks(), getN8nApiKey()]);
      const url = wh[key];
      if (!url) return jsonResponse(400, { ok: false, error: `Webhook URL not configured for ${which}` });
      const payload = (body.payload as Record<string, unknown>) || {
        event: 'portal.trigger',
        workflow: which,
        triggered_by: user.username,
        triggered_at: new Date().toISOString(),
      };
      fireN8n(url, payload, apiKey);
      await logActivity(user.id, 'n8n', which, 'n8n_triggered', `Triggered n8n workflow: ${which}`);
      return jsonResponse(200, { ok: true, data: { workflow: which, url, fired: true } });
    }

    // ── EMAILS LIST ───────────────────────────────────────────────────────────
    if (op === 'emails' && method === 'GET') {
      const leadId = url.searchParams.get('lead_id');
      const status = url.searchParams.get('status');
      let q = db().from('ps2_lead_emails').select('*')
        .order('created_at', { ascending: false }).limit(200);
      if (leadId) q = q.eq('lead_id', leadId);
      if (status) q = q.eq('status', status);
      const { data, error } = await q;
      if (error) throw error;
      return jsonResponse(200, { ok: true, data: data || [] });
    }

    // ── REVIEW DRAFTS ─────────────────────────────────────────────────────────
    if (op === 'review-drafts' && method === 'GET') {
      const assignedTo = url.searchParams.get('assigned_to');
      const { data: emails } = await db()
        .from('ps2_lead_emails')
        .select('*, ps2_leads!lead_id(id, full_name, company, assigned_to)')
        .eq('status', 'pending_review')
        .order('created_at', { ascending: false });

      let drafts = emails || [];
      if (assignedTo) {
        drafts = drafts.filter(e => {
          const lead = (e as Record<string,unknown>)['ps2_leads'] as Record<string,unknown>;
          return lead && lead['assigned_to'] === assignedTo;
        });
      }

      const leadIds = [...new Set(drafts.map(d => d.lead_id).filter(Boolean))] as string[];
      const inboundsByLead = new Map<string, Record<string, unknown>[]>();
      if (leadIds.length) {
        const { data: inbounds } = await db()
          .from('ps2_lead_emails')
          .select('id, lead_id, subject, body, sentiment, received_at, created_at, thread_id, direction')
          .in('lead_id', leadIds)
          .eq('direction', 'inbound')
          .order('created_at', { ascending: false });
        for (const row of inbounds || []) {
          const lid = String(row.lead_id);
          const list = inboundsByLead.get(lid) || [];
          list.push(row as Record<string, unknown>);
          inboundsByLead.set(lid, list);
        }
      }

      const enriched = drafts.map(d => {
        const lid = String(d.lead_id || '');
        const list = inboundsByLead.get(lid) || [];
        let related: Record<string, unknown> | null = null;
        if (d.thread_id) {
          related = list.find(r => r.thread_id === d.thread_id) || null;
        }
        if (!related) related = list[0] || null;
        return { ...d, related_inbound: related };
      });

      return jsonResponse(200, { ok: true, data: enriched });
    }

    // ── CREATE EMAIL ──────────────────────────────────────────────────────────
    if (op === 'email' && method === 'POST') {
      if (user.role === 'pt_admin') return forbidden();
      let body: Record<string, unknown> = {};
      try { body = await req.json(); } catch { /* */ }
      if (!body.lead_id) return jsonResponse(400, { ok: false, error: 'lead_id required' });
      const row = {
        lead_id: body.lead_id,
        direction: body.direction || 'outbound',
        subject: body.subject || null,
        body: body.body || null,
        sentiment: body.sentiment || null,
        sequence_step: body.sequence_step || null,
        status: body.status || 'draft',
        is_ai_draft: Boolean(body.is_ai_draft),
        sent_at: body.sent_at || null,
        received_at: body.received_at || null,
        created_by: user.id,
      };
      const { data, error } = await db().from('ps2_lead_emails').insert(row).select('*').single();
      if (error) throw error;

      // Update lead last_activity_at
      await db().from('ps2_leads')
        .update({ last_activity_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', String(body.lead_id));

      const action = row.direction === 'inbound' ? 'reply_received' : 'email_sent';
      const summary = row.direction === 'inbound'
        ? `Reply received (sentiment: ${row.sentiment || 'unknown'})`
        : `Email sent (step ${row.sequence_step || '?'})`;
      await logActivity(user.id, 'lead_email', String(body.lead_id), action, summary);
      return jsonResponse(201, { ok: true, data: { email: data } });
    }

    // ── PATCH EMAIL ───────────────────────────────────────────────────────────
    if (op === 'email' && id && method === 'PATCH') {
      if (user.role === 'pt_admin') return forbidden();
      let body: Record<string, unknown> = {};
      try { body = await req.json(); } catch { /* */ }
      const allowed = ['status','body','sentiment','sent_at'];
      const patch: Record<string, unknown> = {};
      for (const k of allowed) if (Object.prototype.hasOwnProperty.call(body, k)) patch[k] = body[k];
      const { data, error } = await db()
        .from('ps2_lead_emails').update(patch).eq('id', id).select('*').single();
      if (error) throw error;
      if (!data) return jsonResponse(404, { ok: false, error: 'Email not found' });
      if (patch.status === 'approved') {
        await logActivity(user.id, 'lead_email', data.lead_id, 'draft_approved', 'AI draft approved for sending');
      }
      return jsonResponse(200, { ok: true, data: { email: data } });
    }

    // ── MAIL CONFIG ───────────────────────────────────────────────────────────
    if (op === 'mail-config' && method === 'GET') {
      const { data, error } = await db()
        .from('ps2_mail_sequence_config').select('*')
        .eq('organization_id', ORG_ID).order('step_number');
      if (error) throw error;
      return jsonResponse(200, { ok: true, data: data || [] });
    }

    if (op === 'mail-config' && method === 'PATCH') {
      if (user.role !== 'sahasra_admin') return forbidden('Only sahasra_admin can edit mail config');
      let body: Record<string, unknown> = {};
      try { body = await req.json(); } catch { /* */ }
      const { step_number, ...updates } = body;
      if (!step_number) return jsonResponse(400, { ok: false, error: 'step_number required' });
      const allowed = ['label','day_offset','subject_template','body_template','is_active'];
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const k of allowed) if (Object.prototype.hasOwnProperty.call(updates, k)) patch[k] = updates[k];
      const { data, error } = await db()
        .from('ps2_mail_sequence_config').update(patch)
        .eq('organization_id', ORG_ID).eq('step_number', step_number).select('*').single();
      if (error) throw error;
      return jsonResponse(200, { ok: true, data });
    }

    // ── USERS ─────────────────────────────────────────────────────────────────
    if (op === 'users' && method === 'GET') {
      if (user.role !== 'sahasra_admin') return forbidden();
      const { data, error } = await db()
        .from('ps2_users').select('id, username, full_name, role, outlook_account, is_active, created_at')
        .eq('organization_id', ORG_ID).order('created_at');
      if (error) throw error;
      return jsonResponse(200, { ok: true, data: data || [] });
    }

    if (op === 'user' && method === 'POST') {
      if (user.role !== 'sahasra_admin') return forbidden();
      let body: Record<string, unknown> = {};
      try { body = await req.json(); } catch { /* */ }
      const username = String(body.username || '').trim();
      const password = String(body.password || '');
      if (!username || !password) return jsonResponse(400, { ok: false, error: 'username and password required' });
      // Use pgcrypto for password hashing
      const { data, error } = await db().from('ps2_users').insert({
        organization_id: ORG_ID,
        username,
        password_hash: `placeholder_will_be_hashed`, // will be overwritten by RPC
        full_name: body.full_name || null,
        role: body.role || 'sahasra_employee',
        outlook_account: body.outlook_account || null,
      }).select('id, username, full_name, role, outlook_account, is_active').single();
      if (error) throw error;
      // Hash password via pgcrypto update
      await db().rpc('ps2_set_password', { p_user_id: data.id, p_password: password });
      return jsonResponse(201, { ok: true, data });
    }

    if (op === 'user' && id && method === 'PATCH') {
      if (user.role !== 'sahasra_admin') return forbidden();
      let body: Record<string, unknown> = {};
      try { body = await req.json(); } catch { /* */ }
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (body.full_name !== undefined) patch.full_name = body.full_name;
      if (body.role !== undefined) patch.role = body.role;
      if (body.outlook_account !== undefined) patch.outlook_account = body.outlook_account;
      if (body.is_active !== undefined) patch.is_active = body.is_active;
      const { data, error } = await db()
        .from('ps2_users').update(patch).eq('id', id).eq('organization_id', ORG_ID)
        .select('id, username, full_name, role, outlook_account, is_active').single();
      if (error) throw error;
      if (body.password) {
        await db().rpc('ps2_set_password', { p_user_id: id, p_password: String(body.password) });
      }
      return jsonResponse(200, { ok: true, data });
    }

    if (op === 'user' && id && method === 'DELETE') {
      if (user.role !== 'sahasra_admin') return forbidden();
      if (id === user.id) return forbidden('Cannot delete your own account');
      const { error } = await db()
        .from('ps2_users').update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id).eq('organization_id', ORG_ID);
      if (error) throw error;
      return jsonResponse(200, { ok: true });
    }

    // ── PROJECTS ─────────────────────────────────────────────────────────────
    if (op === 'projects' && method === 'GET') {
      const { data, error } = await db()
        .from('ps2_client_projects').select('*')
        .eq('organization_id', ORG_ID).order('created_at', { ascending: false });
      if (error) throw error;
      return jsonResponse(200, { ok: true, data: data || [] });
    }

    if (op === 'project' && id && method === 'GET') {
      const { data, error } = await db()
        .from('ps2_client_projects').select('*').eq('id', id).eq('organization_id', ORG_ID).maybeSingle();
      if (error) throw error;
      if (!data) return jsonResponse(404, { ok: false, error: 'Project not found' });
      const { data: transitions } = await db()
        .from('ps2_stage_transitions').select('*').eq('project_id', id).order('created_at');
      return jsonResponse(200, { ok: true, data: { project: data, transitions: transitions || [] } });
    }

    if (op === 'project' && method === 'POST') {
      if (user.role === 'pt_admin') return forbidden();
      let body: Record<string, unknown> = {};
      try { body = await req.json(); } catch { /* */ }
      if (!body.client_name || !body.project_name) return jsonResponse(400, { ok: false, error: 'client_name and project_name required' });
      const { data, error } = await db().from('ps2_client_projects').insert({
        organization_id: ORG_ID,
        lead_id: body.lead_id || null,
        client_name: body.client_name,
        project_name: body.project_name,
        order_value: body.order_value || null,
        stage: body.stage || 'enquiry_received',
        assigned_to: body.assigned_to || null,
        target_date: body.target_date || null,
        notes: body.notes || null,
        quotation_ref: body.quotation_ref || null,
        stage_entered_at: new Date().toISOString(),
      }).select('*').single();
      if (error) throw error;
      await logActivity(user.id, 'project', data.id, 'project_created', `New project: ${data.project_name} for ${data.client_name}`);
      return jsonResponse(201, { ok: true, data: { project: data } });
    }

    if (op === 'project' && id && method === 'PATCH') {
      if (user.role === 'pt_admin') return forbidden();
      let body: Record<string, unknown> = {};
      try { body = await req.json(); } catch { /* */ }
      const allowed = ['client_name','project_name','order_value','assigned_to','target_date','notes','quotation_ref'];
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const k of allowed) if (Object.prototype.hasOwnProperty.call(body, k)) patch[k] = body[k];
      const { data, error } = await db()
        .from('ps2_client_projects').update(patch).eq('id', id).eq('organization_id', ORG_ID).select('*').single();
      if (error) throw error;
      return jsonResponse(200, { ok: true, data: { project: data } });
    }

    if (op === 'project-advance' && id && method === 'POST') {
      if (user.role === 'pt_admin') return forbidden();
      let body: Record<string, unknown> = {};
      try { body = await req.json(); } catch { /* */ }
      if (!body.to_stage) return jsonResponse(400, { ok: false, error: 'to_stage required' });

      const { data: existing } = await db()
        .from('ps2_client_projects').select('stage').eq('id', id).maybeSingle();
      if (!existing) return jsonResponse(404, { ok: false, error: 'Project not found' });

      const { data, error } = await db()
        .from('ps2_client_projects').update({
          stage: body.to_stage,
          stage_entered_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', id).eq('organization_id', ORG_ID).select('*').single();
      if (error) throw error;

      await db().from('ps2_stage_transitions').insert({
        project_id: id,
        from_stage: existing.stage,
        to_stage: body.to_stage,
        notes: body.notes || null,
        transitioned_by: user.id,
      });
      await logActivity(user.id, 'project', id, 'stage_changed', `Project moved to ${body.to_stage}`);
      return jsonResponse(200, { ok: true, data: { project: data } });
    }

    // ── CONVERT LEAD → PROJECT ────────────────────────────────────────────────
    if (op === 'lead-convert' && id && method === 'POST') {
      if (user.role === 'pt_admin') return forbidden();
      let body: Record<string, unknown> = {};
      try { body = await req.json(); } catch { /* */ }
      const { data: lead } = await db()
        .from('ps2_leads').select('*').eq('id', id).eq('organization_id', ORG_ID).maybeSingle();
      if (!lead) return jsonResponse(404, { ok: false, error: 'Lead not found' });

      const { data: project, error } = await db().from('ps2_client_projects').insert({
        organization_id: ORG_ID,
        lead_id: id,
        client_name: body.client_name || lead.company || lead.full_name,
        project_name: body.project_name || `Project for ${lead.company || lead.full_name}`,
        order_value: body.order_value || null,
        stage: 'enquiry_received',
        assigned_to: lead.assigned_to,
        stage_entered_at: new Date().toISOString(),
      }).select('*').single();
      if (error) throw error;

      await db().from('ps2_leads').update({
        status: 'converted', updated_at: new Date().toISOString(), last_activity_at: new Date().toISOString(),
      }).eq('id', id);
      await logActivity(user.id, 'lead', id, 'lead_converted', `Lead converted → project ${project.id}`);
      return jsonResponse(201, { ok: true, data: { project } });
    }

    // ── GOOGLE SHEET CONNECTIONS ──────────────────────────────────────────────
    if (op === 'sheet-connections' && method === 'GET') {
      const { data, error } = await db()
        .from('ps2_google_sheet_connections').select('*')
        .eq('organization_id', ORG_ID).order('created_at');
      if (error) throw error;
      return jsonResponse(200, { ok: true, data: data || [] });
    }

    if (op === 'sheet-connection' && method === 'POST') {
      if (user.role === 'pt_admin') return forbidden();
      let body: Record<string, unknown> = {};
      try { body = await req.json(); } catch { /* */ }
      const { data, error } = await db().from('ps2_google_sheet_connections').insert({
        organization_id: ORG_ID,
        sheet_url: body.sheet_url,
        sheet_id: body.sheet_id || null,
        tab_name: body.tab_name || 'Sheet1',
        column_mapping: body.column_mapping || {},
        sync_interval_hours: body.sync_interval_hours || 24,
        is_active: true,
        created_by: user.id,
      }).select('*').single();
      if (error) throw error;
      return jsonResponse(201, { ok: true, data });
    }

    if (op === 'sheet-connection' && id && method === 'PATCH') {
      let body: Record<string, unknown> = {};
      try { body = await req.json(); } catch { /* */ }
      const allowed = ['sheet_id','tab_name','column_mapping','sync_interval_hours','is_active','last_synced_at'];
      const patch: Record<string, unknown> = {};
      for (const k of allowed) if (Object.prototype.hasOwnProperty.call(body, k)) patch[k] = body[k];
      const { data, error } = await db()
        .from('ps2_google_sheet_connections').update(patch).eq('id', id).eq('organization_id', ORG_ID).select('*').single();
      if (error) throw error;
      return jsonResponse(200, { ok: true, data });
    }

    // ── OUTLOOK ACCOUNTS ──────────────────────────────────────────────────────
    if (op === 'outlook-accounts' && method === 'GET') {
      const { data } = await db()
        .from('ps2_users')
        .select('id, full_name, outlook_account, is_active')
        .eq('organization_id', ORG_ID)
        .eq('is_active', true)
        .not('outlook_account', 'is', null);
      const accounts = (data || []).map(u => ({
        id: u.id,
        email: u.outlook_account,
        display_name: u.full_name,
        is_connected: true,
        user_id: u.id,
      }));
      return jsonResponse(200, { ok: true, data: accounts });
    }

    // ── SYSTEM SETTINGS ────────────────────────────────────────────────────────
    if (op === 'settings' && method === 'GET') {
      if (user.role !== 'pt_admin' && !isN8n) return forbidden('Only pt_admin can access system settings');
      const { data } = await db()
        .from('ps2_system_settings').select('*').eq('organization_id', ORG_ID);
      const rows = data || [];
      const get = (key: string) => rows.find(r => r.key === key)?.value ?? {};
      const webhooks = get('n8n_webhooks') as Record<string,string>;
      const dbKey = get('n8n_api_key') as Record<string,string> | string;
      const dbKeyStr = typeof dbKey === 'string' ? dbKey : (dbKey?.key || '');
      const keyConfigured = Boolean(Deno.env.get('N8N_API_KEY') || dbKeyStr);
      return jsonResponse(200, {
        ok: true,
        data: {
          ai_prompt_first_email: (get('ai_prompt_first_email') as Record<string,string>).prompt || '',
          ai_prompt_reply: (get('ai_prompt_reply') as Record<string,string>).prompt || '',
          ai_prompt_sentiment: (get('ai_prompt_sentiment') as Record<string,string>).prompt || '',
          n8n_webhooks: {
            send_email: webhooks?.send_email || '',
            sync_sheets: webhooks?.sync_sheets || '',
            process_replies: webhooks?.process_replies || '',
            enrich_website: webhooks?.enrich_website || '',
            extract_pdf: webhooks?.extract_pdf || '',
            add_lead: webhooks?.add_lead || '',
            update_lead: webhooks?.update_lead || '',
          },
          master_sheet: {
            id: MASTER_SHEET_ID,
            url: `https://docs.google.com/spreadsheets/d/${MASTER_SHEET_ID}`,
            gid: MASTER_SHEET_GID,
          },
          n8n_workflows: {
            send_email: '4LukaFFhxKQMceTf',
            process_replies: '3P7CsPNybLQfCVoB',
            sync_sheets: 'W0HLYxXT3BcFBARU',
            enrich_website: 'OEKnJlD68UwnFoPj',
          },
          health: {
            n8n_api_key_configured: keyConfigured,
            anthropic_key_configured: Boolean(Deno.env.get('ANTHROPIC_API_KEY')),
            supabase_service_key_configured: Boolean(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')),
          },
        },
      });
    }

    if (op === 'settings' && method === 'PATCH') {
      if (user.role !== 'pt_admin') return forbidden('Only pt_admin can edit system settings');
      let body: Record<string, unknown> = {};
      try { body = await req.json(); } catch { /* */ }
      const upsert = async (key: string, value: unknown) => {
        await db().from('ps2_system_settings').upsert(
          { organization_id: ORG_ID, key, value, updated_at: new Date().toISOString() },
          { onConflict: 'organization_id,key' }
        );
      };
      if (body.ai_prompt_first_email !== undefined) await upsert('ai_prompt_first_email', { prompt: body.ai_prompt_first_email });
      if (body.ai_prompt_reply !== undefined) await upsert('ai_prompt_reply', { prompt: body.ai_prompt_reply });
      if (body.ai_prompt_sentiment !== undefined) await upsert('ai_prompt_sentiment', { prompt: body.ai_prompt_sentiment });
      if (body.n8n_webhooks !== undefined) {
        const incoming = body.n8n_webhooks as Record<string, string>;
        const current = await getWebhooks();
        await upsert('n8n_webhooks', { ...current, ...incoming });
      }
      if (body.n8n_api_key) await upsert('n8n_api_key', { key: String(body.n8n_api_key) });
      if (body.booking_link !== undefined) await upsert('booking_link', { url: String(body.booking_link || '') });
      return jsonResponse(200, { ok: true });
    }

    // ── HEALTH (v6) ───────────────────────────────────────────────────────────
    if (op === 'health' && method === 'GET') {
      return jsonResponse(200, {
        ok: true,
        data: {
          service: 'ps2-lead-api',
          master: 'google_sheet',
          sheet_id: MASTER_SHEET_ID,
          ts: new Date().toISOString(),
        },
      });
    }

    // ── PORTAL SETTINGS (booking link + master sheet — sahasra roles) ─────────
    if (op === 'portal-settings' && method === 'GET') {
      const { data } = await db()
        .from('ps2_system_settings').select('*').eq('organization_id', ORG_ID);
      const rows = data || [];
      const get = (key: string) => rows.find((r) => r.key === key)?.value ?? {};
      const booking = get('booking_link') as Record<string, string>;
      return jsonResponse(200, {
        ok: true,
        data: {
          booking_link: booking?.url || '',
          master_sheet: {
            id: MASTER_SHEET_ID,
            url: `https://docs.google.com/spreadsheets/d/${MASTER_SHEET_ID}`,
            embed_url: `https://docs.google.com/spreadsheets/d/${MASTER_SHEET_ID}/htmlview?gid=${MASTER_SHEET_GID}&widget=true&headers=false`,
            tab: 'Sheet1',
            gid: MASTER_SHEET_GID,
          },
        },
      });
    }

    if (op === 'portal-settings' && method === 'PATCH') {
      if (user.role === 'sahasra_employee') return forbidden('Admin only');
      let body: Record<string, unknown> = {};
      try { body = await req.json(); } catch { /* */ }
      if (body.booking_link !== undefined) {
        await db().from('ps2_system_settings').upsert(
          {
            organization_id: ORG_ID,
            key: 'booking_link',
            value: { url: String(body.booking_link || '') },
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'organization_id,key' },
        );
      }
      return jsonResponse(200, { ok: true });
    }

    // ── SHEET LEADS (v6 master DB read via public CSV export) ─────────────────
    if (op === 'sheet-leads' && method === 'GET') {
      const csvUrl =
        `https://docs.google.com/spreadsheets/d/${MASTER_SHEET_ID}/export?format=csv&gid=${MASTER_SHEET_GID}`;
      const sheetRes = await fetch(csvUrl, { redirect: 'follow' });
      if (!sheetRes.ok) {
        return jsonResponse(502, {
          ok: false,
          error: `Could not fetch master sheet (HTTP ${sheetRes.status}). Confirm the sheet is shared Anyone with the link can view.`,
        });
      }
      const text = await sheetRes.text();
      if (/<!DOCTYPE html>|Sign in/i.test(text.slice(0, 200))) {
        return jsonResponse(502, {
          ok: false,
          error: 'Master sheet export returned HTML — check sharing (Anyone with the link → Viewer).',
        });
      }
      const grid = parseCsv(text);
      if (grid.length < 2) {
        return jsonResponse(200, { ok: true, data: { leads: [], total: 0, sheet_id: MASTER_SHEET_ID } });
      }
      const headers = grid[0];
      const leads = grid.slice(1).map((cells, i) => mapSheetRow(headers, cells, i + 2))
        .filter((l) => l.full_name || l.email || l.company);
      return jsonResponse(200, {
        ok: true,
        data: { leads, total: leads.length, sheet_id: MASTER_SHEET_ID, fetched_at: new Date().toISOString() },
      });
    }

    return jsonResponse(404, { ok: false, error: `Unknown op: ${op}` });

  } catch (err) {
    const status = (err as Error & { status?: number }).status ?? 500;
    return jsonResponse(status, { ok: false, error: err instanceof Error ? err.message : 'Server error' });
  }
});
