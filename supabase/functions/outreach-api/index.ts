import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { bearerToken, verifyFirebaseIdToken } from '../_shared/firebase-auth.ts';
import { jsonResponse, optionsResponse } from '../_shared/cors.ts';
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
} from '../_shared/outreach-helpers.ts';

function adminDb() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Supabase admin env missing');
  return createClient(url, key, { auth: { persistSession: false } });
}

function toApi(row: Record<string, unknown>) {
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

function toSeqContact(row: Record<string, unknown>) {
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

async function requireAuth(req: Request) {
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

function parseSort(sort: string | null): { column: string; ascending: boolean } {
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

function coerceDate(value: unknown): string | null | undefined {
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

async function getConfigMap(db: ReturnType<typeof adminDb>) {
  const { data } = await db.from('outreach_portal_config').select('key,value');
  const map: Record<string, string> = {};
  for (const row of data || []) {
    if (row?.key) map[row.key] = String(row.value ?? '');
  }
  return map;
}

async function fireN8nWebhook(
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

async function ensureCadence(db: ReturnType<typeof adminDb>) {
  const { data, error } = await db.from('outreach_config').select('*').eq('id', 1).maybeSingle();
  if (error) throw error;
  if (data) return data;
  const { data: created, error: insertErr } = await db
    .from('outreach_config')
    .insert({ id: 1, cadence_days: DEFAULT_CADENCE })
    .select('*')
    .single();
  if (insertErr) throw insertErr;
  return created;
}

function prevSentAt(row: Record<string, unknown>, prevFollowUpNum: number): Date | null {
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

function groupByFollowUp(logs: { follow_up_num: number }[]) {
  const out: Record<number, number> = {};
  for (const log of logs) {
    out[log.follow_up_num] = (out[log.follow_up_num] || 0) + 1;
  }
  return out;
}

function trackBreakdown(logs: { track?: string | null }[]) {
  return {
    A: logs.filter((l) => (l.track || '').includes('Startups')).length,
    B: logs.filter((l) => (l.track || '').includes('EMS')).length,
  };
}

async function findIndustry(db: ReturnType<typeof adminDb>, idOrSlug: string) {
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

function toIndustryApi(row: Record<string, unknown>) {
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

function toTemplateApi(row: Record<string, unknown>) {
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

async function sumHistorical(db: ReturnType<typeof adminDb>, industryId: string): Promise<number> {
  const { data, error } = await db
    .from('outreach_historical_sends')
    .select('count')
    .eq('industry_id', industryId);
  if (error) throw error;
  return (data || []).reduce((sum: number, r: { count: number }) => sum + (r.count || 0), 0);
}

async function resolveCadence(
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

async function templateForStep(
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse();

  const url = new URL(req.url);
  const path =
    url.pathname.replace(/^\/functions\/v1\/outreach-api/, '').replace(/^\/outreach-api/, '') ||
    '/';

  try {
    if (req.method === 'GET' && (path === '/health' || path === '/api/health')) {
      return jsonResponse(200, { ok: true, service: 'outreach-portal' });
    }

    const auth = await requireAuth(req);
    const db = auth.db;

    // GET /api/config
    if (req.method === 'GET' && (path === '/api/config' || path === '/config')) {
      const row = await ensureCadence(db);
      return jsonResponse(200, {
        cadenceDays: normalizeCadence(row.cadence_days),
        updatedAt: row.updated_at
          ? new Date(String(row.updated_at)).toISOString()
          : new Date().toISOString(),
      });
    }

    // PUT /api/config
    if (req.method === 'PUT' && (path === '/api/config' || path === '/config')) {
      const body = await req.json().catch(() => ({}));
      const parsed = parseCadenceDays(body?.cadenceDays);
      if (!parsed.ok) {
        return jsonResponse(400, { error: parsed.error });
      }
      const { data, error } = await db
        .from('outreach_config')
        .upsert({
          id: 1,
          cadence_days: parsed.days,
          updated_at: new Date().toISOString(),
        })
        .select('*')
        .single();
      if (error) throw error;
      return jsonResponse(200, {
        cadenceDays: normalizeCadence(data.cadence_days),
        updatedAt: new Date(String(data.updated_at)).toISOString(),
      });
    }

    // GET /api/industries
    if (req.method === 'GET' && (path === '/api/industries' || path === '/industries')) {
      const includeArchived = url.searchParams.get('includeArchived') === '1';
      let q = db.from('outreach_industries').select('*').order('name', { ascending: true });
      if (!includeArchived) q = q.eq('is_archived', false);
      const { data: rows, error } = await q;
      if (error) throw error;

      const result = [];
      for (const ind of rows || []) {
        const [
          { count: contactCount },
          { count: activeContacts },
          { count: liveSent },
        ] = await Promise.all([
          db
            .from('outreach_contacts')
            .select('id', { count: 'exact', head: true })
            .eq('industry_id', ind.id),
          db
            .from('outreach_contacts')
            .select('id', { count: 'exact', head: true })
            .eq('industry_id', ind.id)
            .in('status', ACTIVE_PIPELINE),
          db
            .from('outreach_email_logs')
            .select('id', { count: 'exact', head: true })
            .eq('industry_id', ind.id),
        ]);
        const histSum = await sumHistorical(db, ind.id as string);
        result.push({
          ...toIndustryApi(ind),
          contactCount: contactCount || 0,
          activeContacts: activeContacts || 0,
          totalSent: (liveSent || 0) + histSum,
        });
      }
      return jsonResponse(200, result);
    }

    // POST /api/industries
    if (req.method === 'POST' && (path === '/api/industries' || path === '/industries')) {
      const body = await req.json().catch(() => ({}));
      const name = String(body?.name || '').trim();
      if (name.length < 2 || name.length > 80) {
        return jsonResponse(400, { error: 'name must be 2–80 characters' });
      }
      const slug = slugify(name);
      if (!slug) return jsonResponse(400, { error: 'Could not derive slug from name' });

      const { data: existingByName } = await db
        .from('outreach_industries')
        .select('id')
        .eq('name', name)
        .maybeSingle();
      const { data: existingBySlug } = await db
        .from('outreach_industries')
        .select('id')
        .eq('slug', slug)
        .maybeSingle();
      if (existingByName || existingBySlug) {
        return jsonResponse(409, { error: 'Industry name or slug already exists' });
      }

      const id = newId('ind');
      const { data: created, error } = await db
        .from('outreach_industries')
        .insert({
          id,
          name,
          slug,
          description: body?.description != null ? String(body.description) : null,
          color: body?.color ? String(body.color) : '#6366f1',
        })
        .select('*')
        .single();
      if (error) {
        if (error.code === '23505') {
          return jsonResponse(409, { error: 'Industry name or slug already exists' });
        }
        throw error;
      }

      const defaults = DEFAULT_TEMPLATES[slug];
      if (defaults) {
        await db.from('outreach_email_templates').insert(
          defaults.map((t) => ({
            id: newId('tpl'),
            industry_id: id,
            follow_up_num: t.followUpNum,
            name: t.name,
            subject: t.subject,
            body: t.body,
            template_type: t.templateType || 'ai',
          })),
        );
      }

      return jsonResponse(201, toIndustryApi(created));
    }

    // PUT /api/industries/:id
    const putIndustry = path.match(/^\/(?:api\/)?industries\/([^/]+)$/);
    if (req.method === 'PUT' && putIndustry) {
      const industry = await findIndustry(db, putIndustry[1]);
      if (!industry) return jsonResponse(404, { error: 'Industry not found' });

      const body = await req.json().catch(() => ({}));
      const data: Record<string, unknown> = {};
      if (body?.name != null) {
        const name = String(body.name).trim();
        if (name.length < 2 || name.length > 80) {
          return jsonResponse(400, { error: 'name must be 2–80 characters' });
        }
        data.name = name;
        data.slug = slugify(name);
      }
      if (body?.description !== undefined) {
        data.description = body.description == null ? null : String(body.description);
      }
      if (body?.color != null) data.color = String(body.color);
      if (body?.isArchived != null) data.is_archived = Boolean(body.isArchived);
      data.updated_at = new Date().toISOString();

      const { data: updated, error } = await db
        .from('outreach_industries')
        .update(data)
        .eq('id', industry.id)
        .select('*')
        .single();
      if (error) throw error;
      return jsonResponse(200, toIndustryApi(updated));
    }

    // DELETE /api/industries/:id — soft archive
    const deleteIndustry = path.match(/^\/(?:api\/)?industries\/([^/]+)$/);
    if (req.method === 'DELETE' && deleteIndustry) {
      const industry = await findIndustry(db, deleteIndustry[1]);
      if (!industry) return jsonResponse(404, { error: 'Industry not found' });

      const { count: active } = await db
        .from('outreach_contacts')
        .select('id', { count: 'exact', head: true })
        .eq('industry_id', industry.id)
        .not('status', 'in', '(Replied,Bounced,Unsubscribed)');
      if ((active || 0) > 0) {
        return jsonResponse(400, {
          error: `Cannot archive: ${active} active contacts remain (not Replied/Bounced/Unsubscribed)`,
        });
      }

      const { data: updated, error } = await db
        .from('outreach_industries')
        .update({ is_archived: true, updated_at: new Date().toISOString() })
        .eq('id', industry.id)
        .select('*')
        .single();
      if (error) throw error;
      return jsonResponse(200, toIndustryApi(updated));
    }

    // GET /api/industries/:id/config
    const getIndustryConfig = path.match(/^\/(?:api\/)?industries\/([^/]+)\/config$/);
    if (req.method === 'GET' && getIndustryConfig) {
      const industry = await findIndustry(db, getIndustryConfig[1]);
      if (!industry) return jsonResponse(404, { error: 'Industry not found' });

      const { data: cfg } = await db
        .from('outreach_industry_config')
        .select('*')
        .eq('industry_id', industry.id)
        .maybeSingle();
      if (cfg) {
        return jsonResponse(200, {
          source: 'industry',
          cadenceDays: normalizeCadence(cfg.cadence_days),
          updatedAt: cfg.updated_at ? new Date(String(cfg.updated_at)).toISOString() : null,
        });
      }
      const global = await ensureCadence(db);
      return jsonResponse(200, {
        source: 'global',
        cadenceDays: normalizeCadence(global.cadence_days),
        updatedAt: global.updated_at ? new Date(String(global.updated_at)).toISOString() : null,
      });
    }

    // PUT /api/industries/:id/config
    const putIndustryConfig = path.match(/^\/(?:api\/)?industries\/([^/]+)\/config$/);
    if (req.method === 'PUT' && putIndustryConfig) {
      const industry = await findIndustry(db, putIndustryConfig[1]);
      if (!industry) return jsonResponse(404, { error: 'Industry not found' });

      const body = await req.json().catch(() => ({}));
      const parsed = parseCadenceDays(body?.cadenceDays);
      if (!parsed.ok) {
        return jsonResponse(400, { error: parsed.error });
      }

      const { data: cfg, error } = await db
        .from('outreach_industry_config')
        .upsert(
          {
            id: newId('cfg'),
            industry_id: industry.id,
            cadence_days: parsed.days,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'industry_id' },
        )
        .select('*')
        .single();
      if (error) throw error;
      return jsonResponse(200, {
        source: 'industry',
        cadenceDays: normalizeCadence(cfg.cadence_days),
        updatedAt: new Date(String(cfg.updated_at)).toISOString(),
      });
    }

    // DELETE /api/industries/:id/config — revert to global cadence
    const deleteIndustryConfig = path.match(/^\/(?:api\/)?industries\/([^/]+)\/config$/);
    if (req.method === 'DELETE' && deleteIndustryConfig) {
      const industry = await findIndustry(db, deleteIndustryConfig[1]);
      if (!industry) return jsonResponse(404, { error: 'Industry not found' });

      await db.from('outreach_industry_config').delete().eq('industry_id', industry.id);
      const global = await ensureCadence(db);
      return jsonResponse(200, {
        source: 'global',
        cadenceDays: normalizeCadence(global.cadence_days),
        updatedAt: global.updated_at ? new Date(String(global.updated_at)).toISOString() : null,
      });
    }

    // GET /api/industries/:id/templates
    const getTemplates = path.match(/^\/(?:api\/)?industries\/([^/]+)\/templates$/);
    if (req.method === 'GET' && getTemplates) {
      const industry = await findIndustry(db, getTemplates[1]);
      if (!industry) return jsonResponse(404, { error: 'Industry not found' });

      const { data: rows, error } = await db
        .from('outreach_email_templates')
        .select('*')
        .eq('industry_id', industry.id)
        .order('follow_up_num', { ascending: true });
      if (error) throw error;
      return jsonResponse(200, (rows || []).map(toTemplateApi));
    }

    // POST /api/industries/:id/templates
    const postTemplate = path.match(/^\/(?:api\/)?industries\/([^/]+)\/templates$/);
    if (req.method === 'POST' && postTemplate) {
      const industry = await findIndustry(db, postTemplate[1]);
      if (!industry) return jsonResponse(404, { error: 'Industry not found' });

      const body = await req.json().catch(() => ({}));
      const followUpNum = Number.parseInt(String(body?.followUpNum), 10);
      if (!Number.isInteger(followUpNum) || followUpNum < 1 || followUpNum > 10) {
        return jsonResponse(400, { error: 'followUpNum must be 1–10' });
      }
      const name = String(body?.name || '').trim();
      const subject = String(body?.subject || '').trim();
      const templateBody = String(body?.body || '').trim();
      if (!name || !subject || !templateBody) {
        return jsonResponse(400, { error: 'name, subject, and body are required' });
      }
      const templateType = body?.templateType === 'static' ? 'static' : 'ai';

      const { data: created, error } = await db
        .from('outreach_email_templates')
        .insert({
          id: newId('tpl'),
          industry_id: industry.id,
          follow_up_num: followUpNum,
          name,
          subject,
          body: templateBody,
          template_type: templateType,
        })
        .select('*')
        .single();
      if (error) {
        if (error.code === '23505') {
          return jsonResponse(409, { error: 'Template already exists for this step' });
        }
        throw error;
      }
      return jsonResponse(201, toTemplateApi(created));
    }

    // PUT /api/industries/:id/templates/:templateId
    const putTemplate = path.match(/^\/(?:api\/)?industries\/([^/]+)\/templates\/([^/]+)$/);
    if (req.method === 'PUT' && putTemplate) {
      const industry = await findIndustry(db, putTemplate[1]);
      if (!industry) return jsonResponse(404, { error: 'Industry not found' });
      const { data: existing } = await db
        .from('outreach_email_templates')
        .select('*')
        .eq('id', putTemplate[2])
        .eq('industry_id', industry.id)
        .maybeSingle();
      if (!existing) return jsonResponse(404, { error: 'Template not found' });

      const body = await req.json().catch(() => ({}));
      const data: Record<string, unknown> = {};
      if (body?.name != null) data.name = String(body.name).trim();
      if (body?.subject != null) data.subject = String(body.subject).trim();
      if (body?.body != null) data.body = String(body.body);
      if (body?.templateType != null) {
        data.template_type = body.templateType === 'static' ? 'static' : 'ai';
      }
      if (body?.isActive != null) data.is_active = Boolean(body.isActive);
      data.updated_at = new Date().toISOString();

      const { data: updated, error } = await db
        .from('outreach_email_templates')
        .update(data)
        .eq('id', existing.id)
        .select('*')
        .single();
      if (error) throw error;
      return jsonResponse(200, toTemplateApi(updated));
    }

    // DELETE /api/industries/:id/templates/:templateId
    const deleteTemplate = path.match(/^\/(?:api\/)?industries\/([^/]+)\/templates\/([^/]+)$/);
    if (req.method === 'DELETE' && deleteTemplate) {
      const industry = await findIndustry(db, deleteTemplate[1]);
      if (!industry) return jsonResponse(404, { error: 'Industry not found' });
      const { data: existing } = await db
        .from('outreach_email_templates')
        .select('*')
        .eq('id', deleteTemplate[2])
        .eq('industry_id', industry.id)
        .maybeSingle();
      if (!existing) return jsonResponse(404, { error: 'Template not found' });

      await db.from('outreach_email_templates').delete().eq('id', existing.id);
      return jsonResponse(200, {
        ok: true,
        warning: `Deleting this template will leave step ${existing.follow_up_num} with no template. n8n will skip these contacts.`,
      });
    }

    // GET /api/industries/:id/stats
    const industryStats = path.match(/^\/(?:api\/)?industries\/([^/]+)\/stats$/);
    if (req.method === 'GET' && industryStats) {
      const industry = await findIndustry(db, industryStats[1]);
      if (!industry) return jsonResponse(404, { error: 'Industry not found' });

      const now = new Date();
      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - 7);

      const [
        { data: statusRows },
        { data: todayLogs },
        { data: weekLogs },
        { data: allLogs },
        { data: recent },
        { data: histRows },
      ] = await Promise.all([
        db.from('outreach_contacts').select('status').eq('industry_id', industry.id),
        db
          .from('outreach_email_logs')
          .select('*')
          .eq('industry_id', industry.id)
          .gte('sent_at', startOfToday.toISOString()),
        db
          .from('outreach_email_logs')
          .select('*')
          .eq('industry_id', industry.id)
          .gte('sent_at', startOfWeek.toISOString()),
        db.from('outreach_email_logs').select('*').eq('industry_id', industry.id),
        db
          .from('outreach_email_logs')
          .select('follow_up_num, sent_at, contact:outreach_contacts(name, company)')
          .eq('industry_id', industry.id)
          .order('sent_at', { ascending: false })
          .limit(20),
        db
          .from('outreach_historical_sends')
          .select('follow_up_num, count')
          .eq('industry_id', industry.id),
      ]);

      const pipeline: Record<string, number> = {};
      for (const r of statusRows || []) {
        pipeline[r.status] = (pipeline[r.status] || 0) + 1;
      }

      const histMap: Record<number, number> = {};
      let histTotal = 0;
      for (const h of histRows || []) {
        histMap[h.follow_up_num] = (histMap[h.follow_up_num] || 0) + (h.count || 0);
        histTotal += h.count || 0;
      }
      const liveAll = groupByFollowUp(allLogs || []);
      const combined: Record<number, number> = { ...histMap };
      for (const [k, v] of Object.entries(liveAll)) {
        combined[Number(k)] = (combined[Number(k)] || 0) + v;
      }

      return jsonResponse(200, {
        industry: {
          id: industry.id,
          name: industry.name,
          slug: industry.slug,
          color: industry.color,
        },
        pipeline,
        emailVolume: {
          today: { byFollowUp: groupByFollowUp(todayLogs || []), total: (todayLogs || []).length },
          thisWeek: { byFollowUp: groupByFollowUp(weekLogs || []), total: (weekLogs || []).length },
          allTime: {
            live: { byFollowUp: liveAll, total: (allLogs || []).length },
            historical: { byFollowUp: histMap, total: histTotal },
            combined: { byFollowUp: combined, total: (allLogs || []).length + histTotal },
          },
        },
        recentSends: (recent || []).map((l) => {
          const c = Array.isArray(l.contact) ? l.contact[0] : l.contact;
          return {
            contactName: c?.name || '—',
            company: c?.company || null,
            followUpNum: l.follow_up_num,
            sentAt: l.sent_at ? new Date(String(l.sent_at)).toISOString() : null,
          };
        }),
      });
    }

    // POST /api/industries/:id/contacts/import-csv
    const importCsv = path.match(/^\/(?:api\/)?industries\/([^/]+)\/contacts\/import-csv$/);
    if (req.method === 'POST' && importCsv) {
      const industry = await findIndustry(db, importCsv[1]);
      if (!industry) return jsonResponse(404, { error: 'Industry not found' });

      const body = await req.json().catch(() => ({}));
      let rows: Record<string, unknown>[] = [];
      if (Array.isArray(body?.rows)) {
        rows = body.rows.map((r: Record<string, unknown>, i: number) => ({ ...r, __row: i + 1 }));
      } else if (body?.csv) {
        rows = parseCsv(body.csv).rows;
      } else {
        return jsonResponse(400, { error: 'Provide csv string or rows array' });
      }

      const track = trackForIndustrySlug(industry.slug, industry.name);
      let imported = 0;
      let skipped = 0;
      let errors = 0;
      const skippedReasons: Record<string, unknown>[] = [];

      for (const row of rows) {
        const email = String(row.email || '').trim().toLowerCase();
        const name = String(row.name || '').trim();
        const company = String(row.company || '').trim();
        if (!name || !email || !company) {
          errors++;
          skippedReasons.push({ row: row.__row, email, reason: 'missing name/email/company' });
          continue;
        }
        if (!isValidEmail(email)) {
          errors++;
          skippedReasons.push({ row: row.__row, email, reason: 'invalid email' });
          continue;
        }
        const { data: existingContact } = await db
          .from('outreach_contacts')
          .select('id')
          .eq('email', email)
          .maybeSingle();
        if (existingContact) {
          skipped++;
          skippedReasons.push({ row: row.__row, email, reason: 'already exists' });
          continue;
        }

        const parts = name.split(/\s+/);
        const firstName = parts[0] || name;
        const lastName = parts.slice(1).join(' ') || firstName;
        const domain =
          String(row.domain || '').trim().toLowerCase() || email.split('@')[1] || 'unknown';
        const status = row.status ? String(row.status).trim() : 'Queue';
        const followUpNum = row.followUpNum ? Number.parseInt(String(row.followUpNum), 10) : null;
        const sentAt = row.sentAt ? new Date(String(row.sentAt)) : null;
        const followUpDates =
          Number.isInteger(followUpNum) && sentAt && !Number.isNaN(sentAt.getTime())
            ? { [String(followUpNum)]: sentAt.toISOString() }
            : null;

        const { error: insertErr } = await db.from('outreach_contacts').insert({
          name,
          first_name: firstName,
          last_name: lastName,
          email,
          company,
          domain,
          title: row.title ? String(row.title).trim() : null,
          country: row.country ? String(row.country).trim() : null,
          track,
          industry_id: industry.id,
          status:
            Number.isInteger(followUpNum) && (followUpNum as number) >= 1
              ? `Follow${followUpNum} Sent`
              : status,
          source: 'CSV Import',
          follow_up_dates: followUpDates,
          day1_sent_at: followUpNum === 1 ? sentAt?.toISOString() : null,
          day4_sent_at: followUpNum === 2 ? sentAt?.toISOString() : null,
          day9_sent_at: followUpNum === 3 ? sentAt?.toISOString() : null,
        });
        if (insertErr) {
          errors++;
          skippedReasons.push({ row: row.__row, email, reason: insertErr.message });
          continue;
        }
        imported++;
      }

      return jsonResponse(200, { imported, skipped, errors, skippedReasons });
    }

    // POST /api/industries/:id/contacts/apollo-search
    const apolloSearch = path.match(/^\/(?:api\/)?industries\/([^/]+)\/contacts\/apollo-search$/);
    if (req.method === 'POST' && apolloSearch) {
      const industry = await findIndustry(db, apolloSearch[1]);
      if (!industry) return jsonResponse(404, { error: 'Industry not found' });

      const keys: string[] = [];
      for (let i = 1; i <= 8; i++) {
        const k = Deno.env.get(`APOLLO_KEY_${i}`);
        if (k) keys.push(k);
      }
      if (!keys.length) {
        const single = Deno.env.get('APOLLO_API_KEY');
        if (single) keys.push(single);
      }
      if (!keys.length) {
        return jsonResponse(503, { error: 'No Apollo API keys configured (APOLLO_KEY_1…)' });
      }

      const body = await req.json().catch(() => ({}));
      const limit = Math.min(Math.max(parseInt(String(body?.limit), 10) || 100, 1), 200);
      const searchBody = {
        person_titles: body?.jobTitles || [],
        person_locations: body?.countries || [],
        organization_num_employees_ranges: body?.employeeRange
          ? [String(body.employeeRange)]
          : undefined,
        q_organization_keyword_tags: body?.industries || undefined,
        per_page: Math.min(limit, 100),
        page: 1,
      };

      let people: Record<string, unknown>[] = [];
      let lastErr: Error | null = null;
      for (const key of keys) {
        try {
          const resp = await fetch('https://api.apollo.io/v1/mixed_people/search', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache',
              'X-Api-Key': key,
            },
            body: JSON.stringify(searchBody),
            signal: AbortSignal.timeout(20000),
          });
          if (resp.status === 429) {
            lastErr = new Error('Apollo rate limited');
            continue;
          }
          if (!resp.ok) {
            lastErr = new Error(`Apollo returned ${resp.status}`);
            continue;
          }
          const data = await resp.json();
          people = data.people || data.contacts || [];
          lastErr = null;
          break;
        } catch (err) {
          lastErr = err instanceof Error ? err : new Error('Apollo search failed');
        }
      }
      if (lastErr && !people.length) {
        return jsonResponse(502, { error: lastErr.message || 'Apollo search failed' });
      }

      const track = trackForIndustrySlug(industry.slug, industry.name);
      let imported = 0;
      let skipped = 0;
      const skippedReasons: Record<string, unknown>[] = [];

      for (const p of people.slice(0, limit)) {
        const email = String(p.email || '').trim().toLowerCase();
        const firstName = String(p.first_name || '');
        const lastName = String(p.last_name || '');
        const name = `${firstName} ${lastName}`.trim() || String(p.name || '');
        const org = p.organization as Record<string, unknown> | undefined;
        const acct = p.account as Record<string, unknown> | undefined;
        const company = String(org?.name || acct?.name || '');
        const domain = String(
          org?.primary_domain || (email ? email.split('@')[1] : '') || '',
        ).toLowerCase();
        if (!name || !domain) {
          skipped++;
          continue;
        }
        if (email) {
          const { data: existsByEmail } = await db
            .from('outreach_contacts')
            .select('id')
            .eq('email', email)
            .maybeSingle();
          if (existsByEmail) {
            skipped++;
            skippedReasons.push({ email, reason: 'already exists' });
            continue;
          }
        }
        const { data: dup } = await db
          .from('outreach_contacts')
          .select('id')
          .eq('domain', domain)
          .eq('name', name)
          .maybeSingle();
        if (dup) {
          skipped++;
          skippedReasons.push({ email: email || name, reason: 'already exists' });
          continue;
        }

        const { error: insertErr } = await db.from('outreach_contacts').insert({
          name,
          first_name: firstName || name.split(' ')[0],
          last_name: lastName || name.split(' ').slice(1).join(' ') || firstName,
          email: email || null,
          company: company || null,
          domain,
          title: p.title ? String(p.title) : null,
          country: p.country ? String(p.country) : null,
          track,
          industry_id: industry.id,
          status: 'Queue',
          source: 'Apollo',
        });
        if (!insertErr) imported++;
      }

      return jsonResponse(200, {
        imported,
        skipped,
        errors: 0,
        skippedReasons: skippedReasons.slice(0, 50),
      });
    }

    // POST /api/industries/:id/historical-import
    const historicalImport = path.match(/^\/(?:api\/)?industries\/([^/]+)\/historical-import$/);
    if (req.method === 'POST' && historicalImport) {
      const industry = await findIndustry(db, historicalImport[1]);
      if (!industry) return jsonResponse(404, { error: 'Industry not found' });

      const body = await req.json().catch(() => ({}));
      const mode = body?.mode || 'aggregate';

      if (mode === 'aggregate') {
        const entries = Array.isArray(body?.entries) ? body.entries : [];
        if (!entries.length) return jsonResponse(400, { error: 'entries required' });
        const createdRows: Record<string, unknown>[] = [];
        for (const e of entries) {
          const followUpNum = Number.parseInt(String(e.followUpNum), 10);
          const count = Number.parseInt(String(e.count), 10);
          if (!Number.isInteger(followUpNum) || !Number.isInteger(count)) continue;
          const { data: row, error } = await db
            .from('outreach_historical_sends')
            .insert({
              id: newId('hist'),
              industry_id: industry.id,
              follow_up_num: followUpNum,
              count,
              track_a: Number.parseInt(String(e.trackA), 10) || 0,
              track_b: Number.parseInt(String(e.trackB), 10) || 0,
              period_start: new Date(e.periodStart).toISOString(),
              period_end: new Date(e.periodEnd).toISOString(),
              note: e.note ? String(e.note) : null,
            })
            .select('*')
            .single();
          if (error) throw error;
          createdRows.push(row);
        }
        return jsonResponse(201, { created: createdRows.length, entries: createdRows });
      }

      if (mode === 'contacts') {
        const rows: Record<string, unknown>[] = Array.isArray(body?.rows)
          ? body.rows
          : parseCsv(body?.csv || '').rows;
        const track = trackForIndustrySlug(industry.slug, industry.name);
        let imported = 0;
        for (const row of rows) {
          const email = String(row.email || '').trim().toLowerCase();
          const name = String(row.name || '').trim();
          const company = String(row.company || '').trim();
          const followUpNum = Number.parseInt(String(row.followUpNum), 10);
          const sentAt = new Date(String(row.sentAt));
          if (!name || !email || !company || !Number.isInteger(followUpNum)) continue;
          if (!isValidEmail(email) || Number.isNaN(sentAt.getTime())) continue;
          const { data: exists } = await db
            .from('outreach_contacts')
            .select('id')
            .eq('email', email)
            .maybeSingle();
          if (exists) continue;
          const parts = name.split(/\s+/);
          const { data: contact, error: insertErr } = await db
            .from('outreach_contacts')
            .insert({
              name,
              first_name: parts[0],
              last_name: parts.slice(1).join(' ') || parts[0],
              email,
              company,
              domain: email.split('@')[1],
              title: row.title ? String(row.title) : null,
              country: row.country ? String(row.country) : null,
              track,
              industry_id: industry.id,
              status: `Follow${followUpNum} Sent`,
              source: 'Historical Import',
              follow_up_dates: { [String(followUpNum)]: sentAt.toISOString() },
              day1_sent_at: followUpNum === 1 ? sentAt.toISOString() : null,
              day4_sent_at: followUpNum === 2 ? sentAt.toISOString() : null,
              day9_sent_at: followUpNum === 3 ? sentAt.toISOString() : null,
            })
            .select('*')
            .single();
          if (insertErr) continue;
          await db.from('outreach_email_logs').insert({
            contact_id: contact.id,
            follow_up_num: followUpNum,
            track,
            industry_id: industry.id,
            sent_at: sentAt.toISOString(),
          });
          imported++;
        }
        return jsonResponse(201, { imported });
      }

      return jsonResponse(400, { error: 'mode must be aggregate or contacts' });
    }

    // GET /api/stats
    if (req.method === 'GET' && (path === '/api/stats' || path === '/stats')) {
      const now = new Date();
      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - 7);

      const [
        { data: contacts },
        { data: todayLogs },
        { data: weekLogs },
        { data: allLogs },
        { data: recent },
        { data: industries },
      ] = await Promise.all([
        db.from('outreach_contacts').select('status, track'),
        db.from('outreach_email_logs').select('*').gte('sent_at', startOfToday.toISOString()),
        db.from('outreach_email_logs').select('*').gte('sent_at', startOfWeek.toISOString()),
        db.from('outreach_email_logs').select('*'),
        db
          .from('outreach_email_logs')
          .select('follow_up_num, track, sent_at, contact:outreach_contacts(name, company, track)')
          .order('sent_at', { ascending: false })
          .limit(20),
        db.from('outreach_industries').select('*').eq('is_archived', false),
      ]);

      const list = contacts || [];
      const pipeline: Record<string, number> = {};
      const byTrackMap = new Map<string, number>();
      for (const r of list) {
        pipeline[r.status] = (pipeline[r.status] || 0) + 1;
        const t = r.track || 'Unspecified';
        byTrackMap.set(t, (byTrackMap.get(t) || 0) + 1);
      }
      const today = todayLogs || [];
      const week = weekLogs || [];
      const all = allLogs || [];
      const replied = pipeline.Replied || 0;
      const follow1All = all.filter((l) => l.follow_up_num === 1).length;

      const byIndustry: Record<string, { name: string; total: number; today: number }> = {};
      for (const ind of industries || []) {
        const [{ count: allTime }, { count: todayCount }] = await Promise.all([
          db
            .from('outreach_email_logs')
            .select('id', { count: 'exact', head: true })
            .eq('industry_id', ind.id),
          db
            .from('outreach_email_logs')
            .select('id', { count: 'exact', head: true })
            .eq('industry_id', ind.id)
            .gte('sent_at', startOfToday.toISOString()),
        ]);
        const hist = await sumHistorical(db, ind.id as string);
        byIndustry[ind.slug as string] = {
          name: ind.name as string,
          total: (allTime || 0) + hist,
          today: todayCount || 0,
        };
      }

      return jsonResponse(200, {
        total: list.length,
        pipeline,
        byStatus: Object.entries(pipeline).map(([status, count]) => ({ status, count })),
        byTrack: [...byTrackMap.entries()].map(([track, count]) => ({ track, count })),
        byIndustry,
        replyRate: follow1All > 0 ? replied / follow1All : 0,
        emailVolume: {
          today: {
            byFollowUp: groupByFollowUp(today),
            total: today.length,
            byTrack: trackBreakdown(today),
          },
          thisWeek: {
            byFollowUp: groupByFollowUp(week),
            total: week.length,
            byTrack: trackBreakdown(week),
          },
          allTime: {
            byFollowUp: groupByFollowUp(all),
            total: all.length,
            byTrack: trackBreakdown(all),
          },
        },
        recentSends: (recent || []).map((l) => {
          const c = Array.isArray(l.contact) ? l.contact[0] : l.contact;
          return {
            contactName: c?.name || '—',
            company: c?.company || null,
            track: c?.track || l.track || null,
            followUpNum: l.follow_up_num,
            sentAt: l.sent_at ? new Date(String(l.sent_at)).toISOString() : null,
          };
        }),
        emailsSentToday: {
          total: today.length,
          day1: today.filter((l) => l.follow_up_num === 1).length,
          day4: today.filter((l) => l.follow_up_num === 2).length,
          day9: today.filter((l) => l.follow_up_num === 3).length,
        },
        repliesThisWeek: replied,
      });
    }

    // GET /api/contacts/sequence-ready
    if (
      req.method === 'GET' &&
      (path === '/api/contacts/sequence-ready' || path === '/contacts/sequence-ready')
    ) {
      const track = url.searchParams.get('track');
      const industryParam = url.searchParams.get('industryId') || url.searchParams.get('industry');

      let resolvedIndustryId: string | null = null;
      if (industryParam) {
        const ind = await findIndustry(db, industryParam);
        resolvedIndustryId = (ind?.id as string) || industryParam;
      }

      const { cadenceDays, source: cadenceSource } = await resolveCadence(db, resolvedIndustryId);
      const activeDays = cadenceDays.filter((d): d is number => d !== null);
      const now = new Date();
      const groups: {
        followUpNum: number;
        dayInSequence: number;
        contacts: ReturnType<typeof toSeqContact>[];
      }[] = [];
      const templateCache = new Map<string, Record<string, unknown> | null>();

      for (let i = 0; i < activeDays.length; i++) {
        const followUpNum = i + 1;
        const dayInSequence = activeDays[i];
        let rows: Record<string, unknown>[] = [];

        if (i === 0) {
          let q = db.from('outreach_contacts').select('*').eq('status', 'Email Found').limit(60);
          if (track) q = q.eq('track', track);
          if (resolvedIndustryId) q = q.eq('industry_id', resolvedIndustryId);
          const { data, error } = await q;
          if (error) throw error;
          rows = data || [];
        } else {
          const prevStatuses = statusesCompletedFollowUp(i);
          const gapDays = activeDays[i] - activeDays[i - 1];
          const cutoffDate = new Date(now.getTime() - gapDays * 24 * 60 * 60 * 1000);
          let q = db.from('outreach_contacts').select('*').in('status', prevStatuses).limit(60);
          if (track) q = q.eq('track', track);
          if (resolvedIndustryId) q = q.eq('industry_id', resolvedIndustryId);
          const { data, error } = await q;
          if (error) throw error;
          rows = (data || []).filter((c) => {
            const sentAt = prevSentAt(c, i);
            return sentAt !== null && sentAt <= cutoffDate;
          });
        }

        if (rows.length > 0) {
          const enriched: ReturnType<typeof toSeqContact>[] = [];
          for (const row of rows) {
            const seqContact = toSeqContact(row);
            const template = await templateForStep(
              db,
              templateCache,
              row.industry_id as string | null | undefined,
              followUpNum,
            );
            if (template) {
              seqContact.templateSubject = renderTemplate(template.subject, seqContact);
              seqContact.templateBody = renderTemplate(template.body, seqContact);
              seqContact.templateType = String(template.template_type || 'ai');
            }
            enriched.push(seqContact);
          }
          groups.push({
            followUpNum,
            dayInSequence,
            contacts: enriched,
          });
        }
      }

      return jsonResponse(200, {
        groups,
        activeDays,
        cadenceSource,
        totalContacts: groups.reduce((sum, g) => sum + g.contacts.length, 0),
      });
    }

    // GET /api/contacts
    if (req.method === 'GET' && (path === '/api/contacts' || path === '/contacts')) {
      let q = db.from('outreach_contacts').select('*', { count: 'exact' });
      const status = url.searchParams.get('status');
      const statusIn = url.searchParams.get('status_in');
      const email = url.searchParams.get('email');
      const domain = url.searchParams.get('domain');
      const name = url.searchParams.get('name');
      const track = url.searchParams.get('track');
      const industryId = url.searchParams.get('industryId');
      const limit = Math.min(
        Math.max(parseInt(url.searchParams.get('limit') || '100', 10) || 100, 1),
        1000,
      );
      const { column, ascending } = parseSort(url.searchParams.get('sort'));

      if (status === 'all_followups') q = q.in('status', FOLLOW_STATUSES);
      else if (status) q = q.eq('status', status);
      if (statusIn) {
        q = q.in(
          'status',
          statusIn
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        );
      }
      if (email) q = q.eq('email', email.trim().toLowerCase());
      if (domain) q = q.eq('domain', domain.trim().toLowerCase());
      if (name) q = q.eq('name', name.trim());
      if (track) q = q.ilike('track', `%${track}%`);
      if (industryId) q = q.eq('industry_id', industryId);

      q = q.order(column, { ascending }).limit(limit);
      const { data, error, count } = await q;
      if (error) throw error;
      return jsonResponse(200, {
        contacts: (data || []).map((r) => toApi(r)),
        total: count ?? (data || []).length,
      });
    }

    // GET /api/contacts/:id
    const getOne = path.match(/^\/(?:api\/)?contacts\/([^/]+)$/);
    if (req.method === 'GET' && getOne && getOne[1] !== 'sequence-ready') {
      const { data, error } = await db
        .from('outreach_contacts')
        .select('*')
        .eq('id', getOne[1])
        .maybeSingle();
      if (error) throw error;
      if (!data) return jsonResponse(404, { error: 'Contact not found' });
      return jsonResponse(200, { contact: toApi(data) });
    }

    // POST /api/contacts
    if (req.method === 'POST' && (path === '/api/contacts' || path === '/contacts')) {
      const body = await req.json().catch(() => ({}));
      const name = String(body.name || '').trim();
      const firstName = String(body.firstName || '').trim();
      const lastName = String(body.lastName || '').trim();
      const domain = String(body.domain || '').trim().toLowerCase();
      if (!name || !domain) return jsonResponse(400, { error: 'name and domain are required' });
      if (!firstName || !lastName) {
        return jsonResponse(400, { error: 'firstName and lastName are required' });
      }
      const status = body.status ? String(body.status) : 'Queue';
      if (!STATUSES.includes(status as Status)) {
        return jsonResponse(400, { error: 'Invalid status. Use: ' + STATUSES.join(', ') });
      }
      const emailRaw = body.email != null ? String(body.email).trim() : '';
      const payload = {
        name,
        first_name: firstName,
        last_name: lastName,
        email: emailRaw ? emailRaw.toLowerCase() : null,
        company: body.company != null ? String(body.company).trim() : null,
        domain,
        title: body.title != null ? String(body.title).trim() : null,
        country: body.country != null ? String(body.country).trim() : null,
        track: body.track != null ? String(body.track).trim() : null,
        status,
        source: body.source != null ? String(body.source).trim() : 'Apollo',
        all_permutations: body.allPermutations != null ? String(body.allPermutations) : null,
        follow_up_dates: body.followUpDates ?? null,
        day1_sent_at: coerceDate(body.day1SentAt) ?? null,
        day4_sent_at: coerceDate(body.day4SentAt) ?? null,
        day9_sent_at: coerceDate(body.day9SentAt) ?? null,
        replied_at: coerceDate(body.repliedAt) ?? null,
      };

      const { data, error } = await db.from('outreach_contacts').insert(payload).select('*').single();
      if (error) {
        if (error.code === '23505') {
          return jsonResponse(409, {
            error: 'Contact already exists for this domain + name',
            code: 'DUPLICATE',
          });
        }
        throw error;
      }
      return jsonResponse(201, { contact: toApi(data) });
    }

    // PATCH /api/contacts/:id
    const patchOne = path.match(/^\/(?:api\/)?contacts\/([^/]+)$/);
    if (req.method === 'PATCH' && patchOne) {
      const body = await req.json().catch(() => ({}));
      const { data: existing, error: findErr } = await db
        .from('outreach_contacts')
        .select('*')
        .eq('id', patchOne[1])
        .maybeSingle();
      if (findErr) throw findErr;
      if (!existing) return jsonResponse(404, { error: 'Contact not found' });

      const followUpNum =
        body.followUpNum != null ? Number.parseInt(String(body.followUpNum), 10) : null;

      if (Number.isInteger(followUpNum) && followUpNum! >= 1 && body.sentAt) {
        const sentAt = coerceDate(body.sentAt);
        if (!sentAt) return jsonResponse(400, { error: 'Invalid sentAt' });
        const dates =
          existing.follow_up_dates && typeof existing.follow_up_dates === 'object'
            ? { ...(existing.follow_up_dates as Record<string, string>) }
            : {};
        dates[String(followUpNum)] = sentAt;
        const data: Record<string, unknown> = { follow_up_dates: dates };
        if (followUpNum === 1) data.day1_sent_at = sentAt;
        if (followUpNum === 2) data.day4_sent_at = sentAt;
        if (followUpNum === 3) data.day9_sent_at = sentAt;
        if (body.status != null) {
          const st = normalizeStatus(body.status);
          if (!STATUSES.includes(st as Status)) {
            return jsonResponse(400, { error: 'Invalid status. Use: ' + STATUSES.join(', ') });
          }
          data.status = st;
        } else {
          data.status = `Follow${followUpNum} Sent`;
        }

        const { data: row, error } = await db
          .from('outreach_contacts')
          .update(data)
          .eq('id', patchOne[1])
          .select('*')
          .single();
        if (error) throw error;

        await db.from('outreach_email_logs').insert({
          contact_id: patchOne[1],
          follow_up_num: followUpNum,
          track: row.track,
          industry_id: (body.industryId as string | undefined) ?? row.industry_id ?? null,
          sent_at: sentAt,
        });

        return jsonResponse(200, { contact: toApi(row) });
      }

      const data: Record<string, unknown> = {};
      const map: Record<string, string> = {
        name: 'name',
        firstName: 'first_name',
        lastName: 'last_name',
        email: 'email',
        company: 'company',
        domain: 'domain',
        title: 'title',
        country: 'country',
        track: 'track',
        industryId: 'industry_id',
        status: 'status',
        source: 'source',
        allPermutations: 'all_permutations',
        followUpDates: 'follow_up_dates',
        day1SentAt: 'day1_sent_at',
        day4SentAt: 'day4_sent_at',
        day9SentAt: 'day9_sent_at',
        repliedAt: 'replied_at',
      };

      for (const [k, col] of Object.entries(map)) {
        if (body[k] === undefined) continue;
        if (['day1SentAt', 'day4SentAt', 'day9SentAt', 'repliedAt'].includes(k)) {
          const d = coerceDate(body[k]);
          if (d !== undefined) data[col] = d;
          continue;
        }
        if (k === 'followUpDates') {
          data[col] = body[k];
          continue;
        }
        if (k === 'status') {
          const st = normalizeStatus(body[k]);
          if (!STATUSES.includes(st as Status)) {
            return jsonResponse(400, { error: 'Invalid status. Use: ' + STATUSES.join(', ') });
          }
          data[col] = st;
          continue;
        }
        if (k === 'email') {
          data[col] =
            body[k] == null || body[k] === '' ? null : String(body[k]).trim().toLowerCase();
          continue;
        }
        if (k === 'domain') {
          data[col] = String(body[k]).trim().toLowerCase();
          continue;
        }
        data[col] = body[k] === null ? null : String(body[k]);
      }

      if (!Object.keys(data).length) {
        return jsonResponse(400, { error: 'No updatable fields provided' });
      }

      const { data: row, error } = await db
        .from('outreach_contacts')
        .update(data)
        .eq('id', patchOne[1])
        .select('*')
        .maybeSingle();
      if (error) {
        if (error.code === '23505') {
          return jsonResponse(409, {
            error: 'Contact already exists for this domain + name',
            code: 'DUPLICATE',
          });
        }
        throw error;
      }
      if (!row) return jsonResponse(404, { error: 'Contact not found' });
      return jsonResponse(200, { contact: toApi(row) });
    }

    // Triggers
    if (
      req.method === 'POST' &&
      (path === '/api/triggers/discover' || path === '/triggers/discover')
    ) {
      try {
        const n8n = await fireN8nWebhook(db, 'discover');
        return jsonResponse(200, { ok: true, message: 'Discovery triggered', n8n });
      } catch (err) {
        const status = (err as { status?: number })?.status || 502;
        return jsonResponse(status, {
          ok: false,
          error: err instanceof Error ? err.message : 'Trigger failed',
        });
      }
    }

    if (req.method === 'POST' && (path === '/api/triggers/mail' || path === '/triggers/mail')) {
      const body = await req.json().catch(() => ({}));
      const track = body?.track;
      if (!['A', 'B'].includes(track)) {
        return jsonResponse(400, { ok: false, error: 'track must be A or B' });
      }
      try {
        const n8n = await fireN8nWebhook(db, 'mail', { track });
        return jsonResponse(200, {
          ok: true,
          message: `Mail sequence triggered for Track ${track}`,
          n8n,
        });
      } catch (err) {
        const status = (err as { status?: number })?.status || 502;
        return jsonResponse(status, {
          ok: false,
          error: err instanceof Error ? err.message : 'Trigger failed',
        });
      }
    }

    return jsonResponse(404, { error: 'Not found' });
  } catch (err) {
    const status = (err as { status?: number })?.status || 500;
    console.error(err);
    return jsonResponse(status === 401 || status === 403 ? status : 500, {
      error: err instanceof Error ? err.message : 'outreach-api error',
    });
  }
});
