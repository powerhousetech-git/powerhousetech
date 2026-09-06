import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { bearerToken, verifyFirebaseIdToken } from './firebase-auth.ts';
import { jsonResponse, optionsResponse } from './cors.ts';
import {
  ACTIVE_PIPELINE,
  DEFAULT_CADENCE,
  DEFAULT_TEMPLATES,
  FOLLOW_STATUSES,
  STATUSES,
  isValidEmail,
  newId,
  normalizeCadence,
  normalizeStatus,
  parseCadenceDays,
  parseCsv,
  renderTemplate,
  slugify,
  statusesCompletedFollowUp,
  trackForIndustrySlug,
  type Status,
} from './outreach-helpers.ts';

export function adminDb() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Supabase admin env missing');
  return createClient(url, key, { auth: { persistSession: false } });
}

export function toApi(row: Record<string, unknown>) {
  const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
  return {
    id: row.id,
    name: row.name,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email ?? null,
    company: row.company ?? null,
    domain: row.domain,
    title: row.title ?? null,
    country: row.country ?? null,
    track: row.track ?? null,
    status: row.status,
    source: row.source ?? null,
    allPermutations: row.all_permutations ?? null,
    followUpDates: row.follow_up_dates ?? null,
    day1SentAt: iso(row.day1_sent_at),
    day4SentAt: iso(row.day4_sent_at),
    day9SentAt: iso(row.day9_sent_at),
    repliedAt: iso(row.replied_at),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export function toSeqContact(row: Record<string, unknown>) {
  const str = (v: unknown): string | null => (v == null ? null : String(v));
  return {
    id: str(row.id),
    name: str(row.name),
    firstName: str(row.first_name),
    lastName: str(row.last_name),
    email: str(row.email),
    company: str(row.company),
    domain: str(row.domain),
    title: str(row.title),
    country: str(row.country),
    track: str(row.track),
    status: str(row.status),
    industryId: str(row.industry_id),
    templateSubject: null as string | null,
    templateBody: null as string | null,
    templateType: null as string | null,
  };
}

export async function requireAuth(req: Request) {
  const token = bearerToken(req);
  if (!token) {
    const err = new Error('Sign in required');
    (err as Error & { status: number }).status = 401;
    throw err;
  }

  const db = adminDb();
  const { data: cfg } = await db
    .from('outreach_portal_config')
    .select('value')
    .eq('key', 'api_key')
    .maybeSingle();

  if (cfg?.value && token === cfg.value) {
    return { type: 'api_key' as const, email: 'n8n@system', db };
  }

  const user = await verifyFirebaseIdToken(token);
  const adminEmails = (Deno.env.get('ADMIN_EMAILS') || 'shreyas@powerhousetech.in')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  let isAdmin = adminEmails.includes(user.email);
  if (!isAdmin) {
    const adminApi =
      Deno.env.get('ADMIN_API_URL') ||
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/admin-api?op=me`;
    try {
      const res = await fetch(adminApi, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const body = await res.json();
        isAdmin = Boolean(body?.is_admin);
      }
    } catch {
      /* ignore */
    }
  }
  if (!isAdmin) {
    const err = new Error('Admin access required');
    (err as Error & { status: number }).status = 403;
    throw err;
  }
  return { type: 'firebase' as const, email: user.email, db };
}

export function parseSort(sort: string | null): { column: string; ascending: boolean } {
  if (!sort) return { column: 'created_at', ascending: false };
  const [field, dir] = sort.split(':');
  const map: Record<string, string> = {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    name: 'name',
    company: 'company',
    status: 'status',
    day1SentAt: 'day1_sent_at',
    day4SentAt: 'day4_sent_at',
    day9SentAt: 'day9_sent_at',
    repliedAt: 'replied_at',
  };
  return {
    column: map[field] || 'created_at',
    ascending: dir === 'asc',
  };
}

export function coerceDate(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (value === undefined || value === '') return undefined;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) {
    const err = new Error('Invalid date value');
    (err as Error & { status: number }).status = 400;
    throw err;
  }
  return d.toISOString();
}

export async function getConfigMap(db: ReturnType<typeof adminDb>) {
  const { data } = await db.from('outreach_portal_config').select('key,value');
  const map: Record<string, string> = {};
  for (const row of data || []) {
    if (row?.key) map[row.key] = String(row.value ?? '');
  }
  return map;
}

export async function fireN8nWebhook(
  db: ReturnType<typeof adminDb>,
  kind: 'discover' | 'mail',
  body: Record<string, unknown> = {},
) {
  const cfg = await getConfigMap(db);
  const base = Deno.env.get('N8N_WEBHOOK_BASE_URL') || cfg.n8n_webhook_base_url || '';
  const discoverPath =
    Deno.env.get('N8N_DISCOVER_PATH') || cfg.n8n_discover_path || 'outreach-discover';
  const mailPath = Deno.env.get('N8N_MAIL_PATH') || cfg.n8n_mail_path || 'outreach-mail';
  if (!base) {
    const err = new Error('N8N_WEBHOOK_BASE_URL is not configured');
    (err as Error & { status: number }).status = 503;
    throw err;
  }
  const path = kind === 'discover' ? discoverPath : mailPath;
  const url = `${base.replace(/\/$/, '')}/${String(path).replace(/^\//, '')}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const err = new Error(`n8n returned ${res.status}`);
    (err as Error & { status: number }).status = 502;
    throw err;
  }
  try {
    return await res.json();
  } catch {
    return { ok: true };
  }
}

export async function ensureCadence(db: ReturnType<typeof adminDb>) {
  const { data, error } = await db.from('outreach_config').select('*').eq('id', 1).maybeSingle();
  if (error) throw error;
  if (data) return data;
  const { data: created, error: insertErr } = await db
    .from('outreach_config')
    .insert({ id: 1, cadence_days: DEFAULT_CADENCE, system_enabled: false })
    .select('*')
    .single();
  if (insertErr) throw insertErr;
  return created;
}

export async function isSystemEnabled(db: ReturnType<typeof adminDb>): Promise<boolean> {
  const row = await ensureCadence(db);
  return Boolean(row?.system_enabled);
}

export function prevSentAt(row: Record<string, unknown>, prevFollowUpNum: number): Date | null {
  const dates =
    row.follow_up_dates && typeof row.follow_up_dates === 'object'
      ? (row.follow_up_dates as Record<string, string>)
      : {};
  const key = String(prevFollowUpNum);
  if (dates[key]) return new Date(dates[key]);
  if (prevFollowUpNum === 1 && row.day1_sent_at) return new Date(String(row.day1_sent_at));
  if (prevFollowUpNum === 2 && row.day4_sent_at) return new Date(String(row.day4_sent_at));
  if (prevFollowUpNum === 3 && row.day9_sent_at) return new Date(String(row.day9_sent_at));
  return null;
}

export function groupByFollowUp(logs: { follow_up_num: number }[]) {
  const out: Record<number, number> = {};
  for (const log of logs) {
    out[log.follow_up_num] = (out[log.follow_up_num] || 0) + 1;
  }
  return out;
}

export function trackBreakdown(logs: { track?: string | null }[]) {
  return {
    A: logs.filter((l) => (l.track || '').includes('Startups')).length,
    B: logs.filter((l) => (l.track || '').includes('EMS')).length,
  };
}

export async function findIndustry(db: ReturnType<typeof adminDb>, idOrSlug: string) {
  const { data: byId, error: idErr } = await db
    .from('outreach_industries')
    .select('*')
    .eq('id', idOrSlug)
    .maybeSingle();
  if (idErr) throw idErr;
  if (byId) return byId as Record<string, unknown>;

  const { data: bySlug, error: slugErr } = await db
    .from('outreach_industries')
    .select('*')
    .eq('slug', idOrSlug)
    .maybeSingle();
  if (slugErr) throw slugErr;
  return (bySlug as Record<string, unknown>) || null;
}

export function toIndustryApi(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? null,
    color: row.color,
    isArchived: Boolean(row.is_archived),
    createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : null,
    updatedAt: row.updated_at ? new Date(String(row.updated_at)).toISOString() : null,
  };
}

export function toTemplateApi(row: Record<string, unknown>) {
  return {
    id: row.id,
    industryId: row.industry_id,
    followUpNum: row.follow_up_num,
    name: row.name,
    subject: row.subject,
    body: row.body,
    templateType: row.template_type,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : null,
    updatedAt: row.updated_at ? new Date(String(row.updated_at)).toISOString() : null,
  };
}

export async function sumHistorical(db: ReturnType<typeof adminDb>, industryId: string): Promise<number> {
  const { data, error } = await db
    .from('outreach_historical_sends')
    .select('count')
    .eq('industry_id', industryId);
  if (error) throw error;
  return (data || []).reduce((sum: number, r: { count: number }) => sum + (r.count || 0), 0);
}

export async function resolveCadence(
  db: ReturnType<typeof adminDb>,
  industryId: string | null,
): Promise<{ source: 'industry' | 'global'; cadenceDays: (number | null)[] }> {
  if (industryId) {
    const { data: ic } = await db
      .from('outreach_industry_config')
      .select('cadence_days')
      .eq('industry_id', industryId)
      .maybeSingle();
    if (ic) {
      return { source: 'industry', cadenceDays: normalizeCadence(ic.cadence_days) };
    }
  }
  const cfg = await ensureCadence(db);
  return { source: 'global', cadenceDays: normalizeCadence(cfg.cadence_days) };
}

export async function templateForStep(
  db: ReturnType<typeof adminDb>,
  cache: Map<string, Record<string, unknown> | null>,
  industryId: string | null | undefined,
  followUpNum: number,
): Promise<Record<string, unknown> | null> {
  if (!industryId) return null;
  const key = `${industryId}:${followUpNum}`;
  if (cache.has(key)) return cache.get(key) ?? null;
  const { data, error } = await db
    .from('outreach_email_templates')
    .select('*')
    .eq('industry_id', industryId)
    .eq('follow_up_num', followUpNum)
    .maybeSingle();
  if (error) throw error;
  const template = data && data.is_active ? (data as Record<string, unknown>) : null;
  cache.set(key, template);
  return template;
}

