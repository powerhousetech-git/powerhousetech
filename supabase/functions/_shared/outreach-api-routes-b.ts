import { jsonResponse } from './cors.ts';
import {
  isValidEmail,
  newId,
  parseCsv,
  trackForIndustrySlug,
} from './outreach-helpers.ts';
import {
  isSystemEnabled,
  groupByFollowUp,
  trackBreakdown,
  findIndustry,
  sumHistorical,
} from './outreach-api-lib.ts';

type AuthCtx = { db: ReturnType<typeof import('./outreach-api-lib.ts').adminDb> };

export async function handleMidRoutes(
  req: Request,
  url: URL,
  path: string,
  auth: AuthCtx,
): Promise<Response | null> {
  const db = auth.db;



    // POST /api/industries/:id/contacts/apollo-search
    const apolloSearch = path.match(/^\/(?:api\/)?industries\/([^/]+)\/contacts\/apollo-search$/);
    if (req.method === 'POST' && apolloSearch) {
      if (!(await isSystemEnabled(db))) {
        return jsonResponse(503, { error: 'System paused' });
      }
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


  return null;
}
