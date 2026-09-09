import { jsonResponse } from './cors.ts';
import {
  FOLLOW_STATUSES,
  STATUSES,
  normalizeStatus,
  renderTemplate,
  statusesCompletedFollowUp,
  type Status,
} from './outreach-helpers.ts';
import {
  toApi,
  toSeqContact,
  parseSort,
  coerceDate,
  fireN8nWebhook,
  isSystemEnabled,
  prevSentAt,
  findIndustry,
  resolveCadence,
  templateForStep,
} from './outreach-api-lib.ts';

type AuthCtx = { db: ReturnType<typeof import('./outreach-api-lib.ts').adminDb> };

export async function handleLateRoutes(
  req: Request,
  url: URL,
  path: string,
  auth: AuthCtx,
): Promise<Response | null> {
  const db = auth.db;

    // GET /api/contacts/sequence-ready
    if (
      req.method === 'GET' &&
      (path === '/api/contacts/sequence-ready' || path === '/contacts/sequence-ready')
    ) {
      if (!(await isSystemEnabled(db))) {
        return jsonResponse(200, { groups: [], totalContacts: 0, paused: true });
      }

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

    // POST /api/contacts/apollo-search
    if (
      req.method === 'POST' &&
      (path === '/api/contacts/apollo-search' || path === '/contacts/apollo-search')
    ) {
      if (!(await isSystemEnabled(db))) {
        return jsonResponse(503, { error: 'System paused' });
      }
      return jsonResponse(400, {
        error:
          'Apollo search requires an industry. Use POST /api/industries/:id/contacts/apollo-search',
      });
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


  return null;
}
