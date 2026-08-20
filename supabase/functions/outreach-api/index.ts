import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { bearerToken, verifyFirebaseIdToken } from '../_shared/firebase-auth.ts';
import { jsonResponse, optionsResponse } from '../_shared/cors.ts';

const STATUSES = [
  'Queue',
  'Email Found',
  'Day1 Sent',
  'Day4 Sent',
  'Day9 Sent',
  'Replied',
  'Bounced',
  'Unsubscribed',
] as const;

type Status = (typeof STATUSES)[number];

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
    day1SentAt: iso(row.day1_sent_at),
    day4SentAt: iso(row.day4_sent_at),
    day9SentAt: iso(row.day9_sent_at),
    repliedAt: iso(row.replied_at),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
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

  // Firebase admin for dashboard
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

async function getConfigMap(
  db: ReturnType<typeof adminDb>,
): Promise<Record<string, string>> {
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
  const base =
    Deno.env.get('N8N_WEBHOOK_BASE_URL') ||
    cfg.n8n_webhook_base_url ||
    '';
  const discoverPath =
    Deno.env.get('N8N_DISCOVER_PATH') ||
    cfg.n8n_discover_path ||
    'outreach-discover';
  const mailPath =
    Deno.env.get('N8N_MAIL_PATH') ||
    cfg.n8n_mail_path ||
    'outreach-mail';

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse();

  const url = new URL(req.url);
  // Paths look like /outreach-api/... or /functions/v1/outreach-api/...
  const path = url.pathname.replace(/^\/functions\/v1\/outreach-api/, '').replace(/^\/outreach-api/, '') || '/';

  try {
    if (req.method === 'GET' && (path === '/health' || path === '/api/health')) {
      return jsonResponse(200, { ok: true, service: 'outreach-portal' });
    }

    const auth = await requireAuth(req);
    const db = auth.db;

    // GET /api/stats or /stats
    if (req.method === 'GET' && (path === '/api/stats' || path === '/stats')) {
      const { data: rows, error } = await db.from('outreach_contacts').select('*');
      if (error) throw error;
      const list = rows || [];
      const byStatusMap = new Map<string, number>();
      const byTrackMap = new Map<string, number>();
      const startDay = new Date();
      startDay.setUTCHours(0, 0, 0, 0);
      const dayMs = startDay.getTime();
      const week = new Date(startDay);
      week.setUTCDate(week.getUTCDate() - ((week.getUTCDay() + 6) % 7));
      const weekMs = week.getTime();

      let day1 = 0, day4 = 0, day9 = 0, repliesWeek = 0;
      for (const r of list) {
        byStatusMap.set(r.status, (byStatusMap.get(r.status) || 0) + 1);
        const track = r.track || 'Unspecified';
        byTrackMap.set(track, (byTrackMap.get(track) || 0) + 1);
        if (r.day1_sent_at && new Date(r.day1_sent_at).getTime() >= dayMs) day1++;
        if (r.day4_sent_at && new Date(r.day4_sent_at).getTime() >= dayMs) day4++;
        if (r.day9_sent_at && new Date(r.day9_sent_at).getTime() >= dayMs) day9++;
        if (r.replied_at && new Date(r.replied_at).getTime() >= weekMs) repliesWeek++;
      }

      return jsonResponse(200, {
        total: list.length,
        byStatus: [...byStatusMap.entries()].map(([status, count]) => ({ status, count })),
        byTrack: [...byTrackMap.entries()].map(([track, count]) => ({ track, count })),
        emailsSentToday: { day1, day4, day9, total: day1 + day4 + day9 },
        repliesThisWeek: repliesWeek,
      });
    }

    // GET /api/contacts or /contacts
    if (req.method === 'GET' && (path === '/api/contacts' || path === '/contacts')) {
      let q = db.from('outreach_contacts').select('*', { count: 'exact' });
      const status = url.searchParams.get('status');
      const statusIn = url.searchParams.get('status_in');
      const email = url.searchParams.get('email');
      const domain = url.searchParams.get('domain');
      const name = url.searchParams.get('name');
      const track = url.searchParams.get('track');
      const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '100', 10) || 100, 1), 1000);
      const { column, ascending } = parseSort(url.searchParams.get('sort'));

      if (status) q = q.eq('status', status);
      if (statusIn) {
        q = q.in(
          'status',
          statusIn.split(',').map((s) => s.trim()).filter(Boolean),
        );
      }
      if (email) q = q.eq('email', email.trim().toLowerCase());
      if (domain) q = q.eq('domain', domain.trim().toLowerCase());
      if (name) q = q.eq('name', name.trim());
      // Partial match so ?track=Track+A matches "Track A - Startups"
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
    if (req.method === 'GET' && getOne) {
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
        day1_sent_at: coerceDate(body.day1SentAt) ?? null,
        day4_sent_at: coerceDate(body.day4SentAt) ?? null,
        day9_sent_at: coerceDate(body.day9SentAt) ?? null,
        replied_at: coerceDate(body.repliedAt) ?? null,
      };

      const { data, error } = await db
        .from('outreach_contacts')
        .insert(payload)
        .select('*')
        .single();

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
        if (k === 'status') {
          if (!STATUSES.includes(String(body[k]) as Status)) {
            return jsonResponse(400, { error: 'Invalid status. Use: ' + STATUSES.join(', ') });
          }
          data[col] = String(body[k]);
          continue;
        }
        if (k === 'email') {
          data[col] = body[k] == null || body[k] === ''
            ? null
            : String(body[k]).trim().toLowerCase();
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

    // POST /api/triggers/discover — fire n8n workflow 01 (both tracks)
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

    // POST /api/triggers/mail — fire n8n workflow 03 for track A|B
    if (
      req.method === 'POST' &&
      (path === '/api/triggers/mail' || path === '/triggers/mail')
    ) {
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
