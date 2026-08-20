import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { bearerToken, verifyFirebaseIdToken } from '../_shared/firebase-auth.ts';
import { jsonResponse, optionsResponse } from '../_shared/cors.ts';

const FOLLOW_STATUSES = Array.from({ length: 10 }, (_, i) => `Follow${i + 1} Sent`);
const STATUSES = [
  'Queue',
  'Email Found',
  ...FOLLOW_STATUSES,
  'Replied',
  'Bounced',
  'Unsubscribed',
] as const;
type Status = (typeof STATUSES)[number];

const DEFAULT_CADENCE: (number | null)[] = [1, 4, 9, null, null, null, null, null, null, null];

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

function normalizeCadence(value: unknown): (number | null)[] {
  if (Array.isArray(value) && value.length === 10) {
    return value.map((v) => (v === null || v === undefined ? null : Number(v)));
  }
  return DEFAULT_CADENCE.slice();
}

function parseCadenceDays(raw: unknown) {
  if (!Array.isArray(raw) || raw.length !== 10) {
    return { error: 'cadenceDays must be an array of exactly 10 elements.' };
  }
  const days: (number | null)[] = [];
  for (const v of raw) {
    if (v === null || v === undefined || v === '') {
      days.push(null);
      continue;
    }
    const n = Number.parseInt(String(v), 10);
    if (!Number.isInteger(n) || n < 1) {
      return { error: 'Each element must be null or a positive integer > 0.' };
    }
    days.push(n);
  }
  let seenNull = false;
  for (const d of days) {
    if (d === null) seenNull = true;
    else if (seenNull) {
      return { error: 'Non-null values must all come before null values (no gaps).' };
    }
  }
  const active = days.filter((d): d is number => d !== null);
  for (let i = 1; i < active.length; i++) {
    if (!(active[i - 1] < active[i])) {
      return { error: 'Days must be strictly ascending.' };
    }
  }
  return { days };
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
      if ('error' in parsed && parsed.error) {
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

    // GET /api/stats
    if (req.method === 'GET' && (path === '/api/stats' || path === '/stats')) {
      const now = new Date();
      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - 7);

      const [{ data: contacts }, { data: todayLogs }, { data: weekLogs }, { data: allLogs }, { data: recent }] =
        await Promise.all([
          db.from('outreach_contacts').select('status, track'),
          db.from('outreach_email_logs').select('*').gte('sent_at', startOfToday.toISOString()),
          db.from('outreach_email_logs').select('*').gte('sent_at', startOfWeek.toISOString()),
          db.from('outreach_email_logs').select('*'),
          db
            .from('outreach_email_logs')
            .select('follow_up_num, track, sent_at, contact:outreach_contacts(name, company, track)')
            .order('sent_at', { ascending: false })
            .limit(20),
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

      return jsonResponse(200, {
        total: list.length,
        pipeline,
        byStatus: Object.entries(pipeline).map(([status, count]) => ({ status, count })),
        byTrack: [...byTrackMap.entries()].map(([track, count]) => ({ track, count })),
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
      const cfg = await ensureCadence(db);
      const cadenceDays = normalizeCadence(cfg.cadence_days);
      const activeDays = cadenceDays.filter((d): d is number => d !== null);
      const now = new Date();
      const groups: {
        followUpNum: number;
        dayInSequence: number;
        contacts: ReturnType<typeof toSeqContact>[];
      }[] = [];

      for (let i = 0; i < activeDays.length; i++) {
        const followUpNum = i + 1;
        const dayInSequence = activeDays[i];
        let rows: Record<string, unknown>[] = [];

        if (i === 0) {
          let q = db.from('outreach_contacts').select('*').eq('status', 'Email Found').limit(60);
          if (track) q = q.eq('track', track);
          const { data, error } = await q;
          if (error) throw error;
          rows = data || [];
        } else {
          const prevStatus = `Follow${i} Sent`;
          const gapDays = activeDays[i] - activeDays[i - 1];
          const cutoffDate = new Date(now.getTime() - gapDays * 24 * 60 * 60 * 1000);
          let q = db.from('outreach_contacts').select('*').eq('status', prevStatus).limit(60);
          if (track) q = q.eq('track', track);
          const { data, error } = await q;
          if (error) throw error;
          rows = (data || []).filter((c) => {
            const sentAt = prevSentAt(c, i);
            return sentAt !== null && sentAt <= cutoffDate;
          });
        }

        if (rows.length > 0) {
          groups.push({
            followUpNum,
            dayInSequence,
            contacts: rows.map(toSeqContact),
          });
        }
      }

      return jsonResponse(200, {
        groups,
        activeDays,
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
          const st = String(body.status);
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
          if (!STATUSES.includes(String(body[k]) as Status)) {
            return jsonResponse(400, { error: 'Invalid status. Use: ' + STATUSES.join(', ') });
          }
          data[col] = String(body[k]);
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
