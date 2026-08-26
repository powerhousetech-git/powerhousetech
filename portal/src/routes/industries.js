const express = require('express');
const { createId } = require('@paralleldrive/cuid2');
const { prisma } = require('../db');
const { asyncHandler, jsonError } = require('../middleware/errorHandler');
const {
  ACTIVE_PIPELINE,
  DEFAULT_CADENCE,
  DEFAULT_TEMPLATES,
  slugify,
  trackForIndustrySlug,
  parseCadenceDays,
  normalizeCadence,
  isValidEmail,
  parseCsv,
} = require('../lib/outreach');

const router = express.Router();

async function findIndustry(idOrSlug) {
  return prisma.industry.findFirst({
    where: {
      OR: [{ id: idOrSlug }, { slug: idOrSlug }],
    },
  });
}

function groupByFollowUp(logs, key = 'followUpNum') {
  const out = {};
  for (const log of logs) {
    const k = log[key];
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

/** GET /api/industries */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const includeArchived = String(req.query.includeArchived || '') === '1';
    const industries = await prisma.industry.findMany({
      where: includeArchived ? undefined : { isArchived: false },
      orderBy: { name: 'asc' },
    });

    const result = [];
    for (const ind of industries) {
      const [contactCount, activeContacts, liveSent, histAgg] = await Promise.all([
        prisma.contact.count({ where: { industryId: ind.id } }),
        prisma.contact.count({
          where: { industryId: ind.id, status: { in: ACTIVE_PIPELINE } },
        }),
        prisma.emailLog.count({ where: { industryId: ind.id } }),
        prisma.historicalSend.aggregate({
          where: { industryId: ind.id },
          _sum: { count: true },
        }),
      ]);
      result.push({
        id: ind.id,
        name: ind.name,
        slug: ind.slug,
        color: ind.color,
        description: ind.description,
        isArchived: ind.isArchived,
        contactCount,
        activeContacts,
        totalSent: liveSent + (histAgg._sum.count || 0),
        createdAt: ind.createdAt.toISOString(),
      });
    }
    res.json(result);
  }),
);

/** POST /api/industries */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const name = String(req.body?.name || '').trim();
    if (name.length < 2 || name.length > 80) {
      return jsonError(res, 400, 'name must be 2–80 characters');
    }
    let slug = slugify(name);
    if (!slug) return jsonError(res, 400, 'Could not derive slug from name');
    const existing = await prisma.industry.findFirst({
      where: { OR: [{ name }, { slug }] },
    });
    if (existing) return jsonError(res, 409, 'Industry name or slug already exists');

    const industry = await prisma.industry.create({
      data: {
        id: createId(),
        name,
        slug,
        description: req.body?.description != null ? String(req.body.description) : null,
        color: req.body?.color ? String(req.body.color) : '#6366f1',
      },
    });

    // Seed empty default steps 1–3 AI stubs if matching known slugs
    const defaults = DEFAULT_TEMPLATES[slug];
    if (defaults) {
      for (const t of defaults) {
        await prisma.emailTemplate.create({
          data: {
            id: createId(),
            industryId: industry.id,
            followUpNum: t.followUpNum,
            name: t.name,
            subject: t.subject,
            body: t.body,
            templateType: t.templateType || 'ai',
          },
        });
      }
    }

    res.status(201).json(industry);
  }),
);

/** PUT /api/industries/:id */
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const industry = await findIndustry(req.params.id);
    if (!industry) return jsonError(res, 404, 'Industry not found');

    const data = {};
    if (req.body?.name != null) {
      const name = String(req.body.name).trim();
      if (name.length < 2 || name.length > 80) {
        return jsonError(res, 400, 'name must be 2–80 characters');
      }
      data.name = name;
      data.slug = slugify(name);
    }
    if (req.body?.description !== undefined) {
      data.description =
        req.body.description == null ? null : String(req.body.description);
    }
    if (req.body?.color != null) data.color = String(req.body.color);
    if (req.body?.isArchived != null) data.isArchived = Boolean(req.body.isArchived);

    const updated = await prisma.industry.update({
      where: { id: industry.id },
      data,
    });
    res.json(updated);
  }),
);

/** DELETE /api/industries/:id — soft archive */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const industry = await findIndustry(req.params.id);
    if (!industry) return jsonError(res, 404, 'Industry not found');

    const active = await prisma.contact.count({
      where: {
        industryId: industry.id,
        status: { notIn: ['Replied', 'Bounced', 'Unsubscribed'] },
      },
    });
    if (active > 0) {
      return jsonError(
        res,
        400,
        `Cannot archive: ${active} active contacts remain (not Replied/Bounced/Unsubscribed)`,
      );
    }

    const updated = await prisma.industry.update({
      where: { id: industry.id },
      data: { isArchived: true },
    });
    res.json(updated);
  }),
);

/** GET /api/industries/:id/config */
router.get(
  '/:id/config',
  asyncHandler(async (req, res) => {
    const industry = await findIndustry(req.params.id);
    if (!industry) return jsonError(res, 404, 'Industry not found');

    const cfg = await prisma.industryConfig.findUnique({
      where: { industryId: industry.id },
    });
    if (cfg) {
      return res.json({
        source: 'industry',
        cadenceDays: normalizeCadence(cfg.cadenceDays),
        updatedAt: cfg.updatedAt.toISOString(),
      });
    }
    const global = await prisma.outreachConfig.findUnique({ where: { id: 1 } });
    return res.json({
      source: 'global',
      cadenceDays: normalizeCadence(global?.cadenceDays ?? DEFAULT_CADENCE),
      updatedAt: global?.updatedAt?.toISOString() || null,
    });
  }),
);

/** PUT /api/industries/:id/config */
router.put(
  '/:id/config',
  asyncHandler(async (req, res) => {
    const industry = await findIndustry(req.params.id);
    if (!industry) return jsonError(res, 404, 'Industry not found');
    const parsed = parseCadenceDays(req.body?.cadenceDays);
    if (parsed.error) return jsonError(res, 400, parsed.error);

    const cfg = await prisma.industryConfig.upsert({
      where: { industryId: industry.id },
      create: {
        id: createId(),
        industryId: industry.id,
        cadenceDays: parsed.days,
      },
      update: { cadenceDays: parsed.days },
    });
    res.json({
      source: 'industry',
      cadenceDays: normalizeCadence(cfg.cadenceDays),
      updatedAt: cfg.updatedAt.toISOString(),
    });
  }),
);

/** DELETE /api/industries/:id/config */
router.delete(
  '/:id/config',
  asyncHandler(async (req, res) => {
    const industry = await findIndustry(req.params.id);
    if (!industry) return jsonError(res, 404, 'Industry not found');
    await prisma.industryConfig.deleteMany({ where: { industryId: industry.id } });
    const global = await prisma.outreachConfig.findUnique({ where: { id: 1 } });
    res.json({
      source: 'global',
      cadenceDays: normalizeCadence(global?.cadenceDays ?? DEFAULT_CADENCE),
      updatedAt: global?.updatedAt?.toISOString() || null,
    });
  }),
);

/** GET /api/industries/:id/templates */
router.get(
  '/:id/templates',
  asyncHandler(async (req, res) => {
    const industry = await findIndustry(req.params.id);
    if (!industry) return jsonError(res, 404, 'Industry not found');
    const templates = await prisma.emailTemplate.findMany({
      where: { industryId: industry.id },
      orderBy: { followUpNum: 'asc' },
    });
    res.json(
      templates.map((t) => ({
        id: t.id,
        followUpNum: t.followUpNum,
        name: t.name,
        subject: t.subject,
        body: t.body,
        templateType: t.templateType,
        isActive: t.isActive,
        updatedAt: t.updatedAt.toISOString(),
      })),
    );
  }),
);

/** POST /api/industries/:id/templates */
router.post(
  '/:id/templates',
  asyncHandler(async (req, res) => {
    const industry = await findIndustry(req.params.id);
    if (!industry) return jsonError(res, 404, 'Industry not found');
    const followUpNum = Number.parseInt(req.body?.followUpNum, 10);
    if (!Number.isInteger(followUpNum) || followUpNum < 1 || followUpNum > 10) {
      return jsonError(res, 400, 'followUpNum must be 1–10');
    }
    const name = String(req.body?.name || '').trim();
    const subject = String(req.body?.subject || '').trim();
    const body = String(req.body?.body || '').trim();
    if (!name || !subject || !body) {
      return jsonError(res, 400, 'name, subject, and body are required');
    }
    const templateType = req.body?.templateType === 'static' ? 'static' : 'ai';

    try {
      const created = await prisma.emailTemplate.create({
        data: {
          id: createId(),
          industryId: industry.id,
          followUpNum,
          name,
          subject,
          body,
          templateType,
        },
      });
      res.status(201).json(created);
    } catch (err) {
      if (String(err.code) === 'P2002') {
        return jsonError(res, 409, 'Template already exists for this step');
      }
      throw err;
    }
  }),
);

/** PUT /api/industries/:id/templates/:templateId */
router.put(
  '/:id/templates/:templateId',
  asyncHandler(async (req, res) => {
    const industry = await findIndustry(req.params.id);
    if (!industry) return jsonError(res, 404, 'Industry not found');
    const existing = await prisma.emailTemplate.findFirst({
      where: { id: req.params.templateId, industryId: industry.id },
    });
    if (!existing) return jsonError(res, 404, 'Template not found');

    const data = {};
    if (req.body?.name != null) data.name = String(req.body.name).trim();
    if (req.body?.subject != null) data.subject = String(req.body.subject).trim();
    if (req.body?.body != null) data.body = String(req.body.body);
    if (req.body?.templateType != null) {
      data.templateType = req.body.templateType === 'static' ? 'static' : 'ai';
    }
    if (req.body?.isActive != null) data.isActive = Boolean(req.body.isActive);

    const updated = await prisma.emailTemplate.update({
      where: { id: existing.id },
      data,
    });
    res.json(updated);
  }),
);

/** DELETE /api/industries/:id/templates/:templateId */
router.delete(
  '/:id/templates/:templateId',
  asyncHandler(async (req, res) => {
    const industry = await findIndustry(req.params.id);
    if (!industry) return jsonError(res, 404, 'Industry not found');
    const existing = await prisma.emailTemplate.findFirst({
      where: { id: req.params.templateId, industryId: industry.id },
    });
    if (!existing) return jsonError(res, 404, 'Template not found');

    await prisma.emailTemplate.delete({ where: { id: existing.id } });
    res.json({
      ok: true,
      warning: `Deleting this template will leave step ${existing.followUpNum} with no template. n8n will skip these contacts.`,
    });
  }),
);

/** GET /api/industries/:id/stats */
router.get(
  '/:id/stats',
  asyncHandler(async (req, res) => {
    const industry = await findIndustry(req.params.id);
    if (!industry) return jsonError(res, 404, 'Industry not found');

    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);

    const [statusCounts, todayLogs, weekLogs, allLogs, recent, histByStep] =
      await Promise.all([
        prisma.contact.groupBy({
          by: ['status'],
          where: { industryId: industry.id },
          _count: { id: true },
        }),
        prisma.emailLog.findMany({
          where: { industryId: industry.id, sentAt: { gte: startOfToday } },
        }),
        prisma.emailLog.findMany({
          where: { industryId: industry.id, sentAt: { gte: startOfWeek } },
        }),
        prisma.emailLog.findMany({ where: { industryId: industry.id } }),
        prisma.emailLog.findMany({
          where: { industryId: industry.id },
          orderBy: { sentAt: 'desc' },
          take: 20,
          include: { contact: { select: { name: true, company: true } } },
        }),
        prisma.historicalSend.groupBy({
          by: ['followUpNum'],
          where: { industryId: industry.id },
          _sum: { count: true, trackA: true, trackB: true },
        }),
      ]);

    const pipeline = Object.fromEntries(
      statusCounts.map((s) => [s.status, s._count.id]),
    );
    const histMap = {};
    let histTotal = 0;
    for (const h of histByStep) {
      histMap[h.followUpNum] = h._sum.count || 0;
      histTotal += h._sum.count || 0;
    }
    const liveAll = groupByFollowUp(allLogs);
    const combined = { ...histMap };
    for (const [k, v] of Object.entries(liveAll)) {
      combined[k] = (combined[k] || 0) + v;
    }

    res.json({
      industry: {
        id: industry.id,
        name: industry.name,
        slug: industry.slug,
        color: industry.color,
      },
      pipeline,
      emailVolume: {
        today: {
          byFollowUp: groupByFollowUp(todayLogs),
          total: todayLogs.length,
        },
        thisWeek: {
          byFollowUp: groupByFollowUp(weekLogs),
          total: weekLogs.length,
        },
        allTime: {
          live: { byFollowUp: liveAll, total: allLogs.length },
          historical: { byFollowUp: histMap, total: histTotal },
          combined: {
            byFollowUp: combined,
            total: allLogs.length + histTotal,
          },
        },
      },
      recentSends: recent.map((l) => ({
        contactName: l.contact?.name || '—',
        company: l.contact?.company || null,
        followUpNum: l.followUpNum,
        sentAt: l.sentAt.toISOString(),
      })),
    });
  }),
);

/** POST /api/industries/:id/contacts/import-csv — body: { csv: "..." } or { rows: [...] } */
router.post(
  '/:id/contacts/import-csv',
  asyncHandler(async (req, res) => {
    const industry = await findIndustry(req.params.id);
    if (!industry) return jsonError(res, 404, 'Industry not found');

    let rows = [];
    if (Array.isArray(req.body?.rows)) {
      rows = req.body.rows.map((r, i) => ({ ...r, __row: i + 1 }));
    } else if (req.body?.csv) {
      rows = parseCsv(req.body.csv).rows;
    } else {
      return jsonError(res, 400, 'Provide csv string or rows array');
    }

    const track = trackForIndustrySlug(industry.slug, industry.name);
    let imported = 0;
    let skipped = 0;
    let errors = 0;
    const skippedReasons = [];

    for (const row of rows) {
      const email = String(row.email || '')
        .trim()
        .toLowerCase();
      const name = String(row.name || '').trim();
      const company = String(row.company || '').trim();
      if (!name || !email || !company) {
        errors++;
        skippedReasons.push({
          row: row.__row,
          email,
          reason: 'missing name/email/company',
        });
        continue;
      }
      if (!isValidEmail(email)) {
        errors++;
        skippedReasons.push({ row: row.__row, email, reason: 'invalid email' });
        continue;
      }
      const existing = await prisma.contact.findFirst({ where: { email } });
      if (existing) {
        skipped++;
        skippedReasons.push({
          row: row.__row,
          email,
          reason: 'already exists',
        });
        continue;
      }

      const parts = name.split(/\s+/);
      const firstName = parts[0] || name;
      const lastName = parts.slice(1).join(' ') || firstName;
      const domain =
        String(row.domain || '')
          .trim()
          .toLowerCase() || email.split('@')[1] || 'unknown';
      const status = row.status ? String(row.status).trim() : 'Queue';
      const followUpNum = row.followUpNum
        ? Number.parseInt(row.followUpNum, 10)
        : null;
      const sentAt = row.sentAt ? new Date(row.sentAt) : null;

      const followUpDates =
        Number.isInteger(followUpNum) && sentAt && !Number.isNaN(sentAt.getTime())
          ? { [String(followUpNum)]: sentAt.toISOString() }
          : undefined;

      await prisma.contact.create({
        data: {
          name,
          firstName,
          lastName,
          email,
          company,
          domain,
          title: row.title ? String(row.title).trim() : null,
          country: row.country ? String(row.country).trim() : null,
          track,
          industryId: industry.id,
          status:
            Number.isInteger(followUpNum) && followUpNum >= 1
              ? `Follow${followUpNum} Sent`
              : status,
          source: 'CSV Import',
          followUpDates,
          day1SentAt: followUpNum === 1 ? sentAt : undefined,
          day4SentAt: followUpNum === 2 ? sentAt : undefined,
          day9SentAt: followUpNum === 3 ? sentAt : undefined,
        },
      });
      imported++;
    }

    res.json({ imported, skipped, errors, skippedReasons });
  }),
);

/** POST /api/industries/:id/contacts/apollo-search */
router.post(
  '/:id/contacts/apollo-search',
  asyncHandler(async (req, res) => {
    const config = await prisma.outreachConfig.findFirst();
    if (!config?.systemEnabled) {
      return res.status(503).json({ error: 'System paused' });
    }

    const industry = await findIndustry(req.params.id);
    if (!industry) return jsonError(res, 404, 'Industry not found');

    const keys = [];
    for (let i = 1; i <= 8; i++) {
      const k = process.env[`APOLLO_KEY_${i}`];
      if (k) keys.push(k);
    }
    if (!keys.length && process.env.APOLLO_API_KEY) {
      keys.push(process.env.APOLLO_API_KEY);
    }
    if (!keys.length) {
      return jsonError(res, 503, 'No Apollo API keys configured (APOLLO_KEY_1…)');
    }

    const limit = Math.min(Math.max(parseInt(req.body?.limit, 10) || 100, 1), 200);
    const body = {
      person_titles: req.body?.jobTitles || [],
      person_locations: req.body?.countries || [],
      organization_num_employees_ranges: req.body?.employeeRange
        ? [String(req.body.employeeRange)]
        : undefined,
      q_organization_keyword_tags: req.body?.industries || undefined,
      per_page: Math.min(limit, 100),
      page: 1,
    };

    let people = [];
    let lastErr = null;
    for (const key of keys) {
      try {
        const resp = await fetch('https://api.apollo.io/v1/mixed_people/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
            'X-Api-Key': key,
          },
          body: JSON.stringify(body),
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
        lastErr = err;
      }
    }
    if (lastErr && !people.length) {
      return jsonError(res, 502, lastErr.message || 'Apollo search failed');
    }

    const track = trackForIndustrySlug(industry.slug, industry.name);
    let imported = 0;
    let skipped = 0;
    const skippedReasons = [];

    for (const p of people.slice(0, limit)) {
      const email = String(p.email || p.email_status === 'verified' ? p.email : '')
        .trim()
        .toLowerCase();
      const firstName = p.first_name || '';
      const lastName = p.last_name || '';
      const name = `${firstName} ${lastName}`.trim() || p.name || '';
      const company = p.organization?.name || p.account?.name || '';
      const domain = (
        p.organization?.primary_domain ||
        (email ? email.split('@')[1] : '') ||
        ''
      ).toLowerCase();
      if (!name || !domain) {
        skipped++;
        continue;
      }
      if (email) {
        const exists = await prisma.contact.findFirst({ where: { email } });
        if (exists) {
          skipped++;
          skippedReasons.push({ email, reason: 'already exists' });
          continue;
        }
      }
      const dup = await prisma.contact.findFirst({
        where: { domain, name },
      });
      if (dup) {
        skipped++;
        skippedReasons.push({ email: email || name, reason: 'already exists' });
        continue;
      }

      await prisma.contact.create({
        data: {
          name,
          firstName: firstName || name.split(' ')[0],
          lastName: lastName || name.split(' ').slice(1).join(' ') || firstName,
          email: email || null,
          company: company || null,
          domain,
          title: p.title || null,
          country: p.country || null,
          track,
          industryId: industry.id,
          status: 'Queue',
          source: 'Apollo',
        },
      });
      imported++;
    }

    res.json({
      imported,
      skipped,
      errors: 0,
      skippedReasons: skippedReasons.slice(0, 50),
    });
  }),
);

/** POST /api/industries/:id/historical-import */
router.post(
  '/:id/historical-import',
  asyncHandler(async (req, res) => {
    const industry = await findIndustry(req.params.id);
    if (!industry) return jsonError(res, 404, 'Industry not found');
    const mode = req.body?.mode || 'aggregate';

    if (mode === 'aggregate') {
      const entries = Array.isArray(req.body?.entries) ? req.body.entries : [];
      if (!entries.length) return jsonError(res, 400, 'entries required');
      const created = [];
      for (const e of entries) {
        const followUpNum = Number.parseInt(e.followUpNum, 10);
        const count = Number.parseInt(e.count, 10);
        if (!Number.isInteger(followUpNum) || !Number.isInteger(count)) continue;
        const row = await prisma.historicalSend.create({
          data: {
            id: createId(),
            industryId: industry.id,
            followUpNum,
            count,
            trackA: Number.parseInt(e.trackA, 10) || 0,
            trackB: Number.parseInt(e.trackB, 10) || 0,
            periodStart: new Date(e.periodStart),
            periodEnd: new Date(e.periodEnd),
            note: e.note ? String(e.note) : null,
          },
        });
        created.push(row);
      }
      return res.status(201).json({ created: created.length, entries: created });
    }

    if (mode === 'contacts') {
      const rows = Array.isArray(req.body?.rows)
        ? req.body.rows
        : parseCsv(req.body?.csv || '').rows;
      const track = trackForIndustrySlug(industry.slug, industry.name);
      let imported = 0;
      for (const row of rows) {
        const email = String(row.email || '')
          .trim()
          .toLowerCase();
        const name = String(row.name || '').trim();
        const company = String(row.company || '').trim();
        const followUpNum = Number.parseInt(row.followUpNum, 10);
        const sentAt = new Date(row.sentAt);
        if (!name || !email || !company || !Number.isInteger(followUpNum)) continue;
        if (!isValidEmail(email) || Number.isNaN(sentAt.getTime())) continue;
        const exists = await prisma.contact.findFirst({ where: { email } });
        if (exists) continue;
        const parts = name.split(/\s+/);
        const contact = await prisma.contact.create({
          data: {
            name,
            firstName: parts[0],
            lastName: parts.slice(1).join(' ') || parts[0],
            email,
            company,
            domain: email.split('@')[1],
            title: row.title ? String(row.title) : null,
            country: row.country ? String(row.country) : null,
            track,
            industryId: industry.id,
            status: `Follow${followUpNum} Sent`,
            source: 'Historical Import',
            followUpDates: { [String(followUpNum)]: sentAt.toISOString() },
            day1SentAt: followUpNum === 1 ? sentAt : undefined,
            day4SentAt: followUpNum === 2 ? sentAt : undefined,
            day9SentAt: followUpNum === 3 ? sentAt : undefined,
          },
        });
        await prisma.emailLog.create({
          data: {
            contactId: contact.id,
            followUpNum,
            track,
            industryId: industry.id,
            sentAt,
          },
        });
        imported++;
      }
      return res.status(201).json({ imported });
    }

    return jsonError(res, 400, 'mode must be aggregate or contacts');
  }),
);

module.exports = router;
