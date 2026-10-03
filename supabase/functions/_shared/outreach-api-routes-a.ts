import { jsonResponse } from './cors.ts';
import {
  ACTIVE_PIPELINE,
  DEFAULT_TEMPLATES,
  isValidEmail,
  newId,
  normalizeCadence,
  parseCadenceDays,
  parseCsv,
  slugify,
  trackForIndustrySlug,
} from './outreach-helpers.ts';
import {
  ensureCadence,
  groupByFollowUp,
  findIndustry,
  toIndustryApi,
  toTemplateApi,
  sumHistorical,
} from './outreach-api-lib.ts';

type AuthCtx = { db: ReturnType<typeof import('./outreach-api-lib.ts').adminDb> };

export async function handleEarlyRoutes(
  req: Request,
  url: URL,
  path: string,
  auth: AuthCtx,
): Promise<Response | null> {
  const db = auth.db;

    // GET /api/config
    if (req.method === 'GET' && (path === '/api/config' || path === '/config')) {
      const row = await ensureCadence(db);
      return jsonResponse(200, {
        cadenceDays: normalizeCadence(row.cadence_days),
        systemEnabled: Boolean(row.system_enabled),
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
      const existing = await ensureCadence(db);
      const { data, error } = await db
        .from('outreach_config')
        .upsert({
          id: 1,
          cadence_days: parsed.days,
          system_enabled: Boolean(existing.system_enabled),
          updated_at: new Date().toISOString(),
        })
        .select('*')
        .single();
      if (error) throw error;
      return jsonResponse(200, {
        cadenceDays: normalizeCadence(data.cadence_days),
        systemEnabled: Boolean(data.system_enabled),
        updatedAt: new Date(String(data.updated_at)).toISOString(),
      });
    }

    // POST /api/system/toggle
    if (
      req.method === 'POST' &&
      (path === '/api/system/toggle' || path === '/system/toggle')
    ) {
      const body = await req.json().catch(() => ({}));
      if (typeof body?.enabled !== 'boolean') {
        return jsonResponse(400, { error: 'Body must include { enabled: boolean }' });
      }
      await ensureCadence(db);
      const { data, error } = await db
        .from('outreach_config')
        .update({
          system_enabled: body.enabled,
          updated_at: new Date().toISOString(),
        })
        .eq('id', 1)
        .select('*')
        .single();
      if (error) throw error;
      return jsonResponse(200, { systemEnabled: Boolean(data.system_enabled) });
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

  return null;
}
