const express = require('express');
const { prisma } = require('../db');
const { asyncHandler, jsonError } = require('../middleware/errorHandler');
const {
  STATUSES,
  FOLLOW_STATUSES,
  DEFAULT_CADENCE,
  normalizeCadence,
  normalizeStatus,
  statusesCompletedFollowUp,
} = require('../lib/outreach');

const router = express.Router();

const UPDATABLE = new Set([
  'name',
  'firstName',
  'lastName',
  'email',
  'company',
  'domain',
  'title',
  'country',
  'track',
  'status',
  'source',
  'allPermutations',
  'day1SentAt',
  'day4SentAt',
  'day9SentAt',
  'followUpDates',
  'repliedAt',
]);

function parseSort(sort) {
  if (!sort || typeof sort !== 'string') {
    return { createdAt: 'desc' };
  }
  const [field, dir] = sort.split(':');
  const allowed = new Set([
    'createdAt',
    'updatedAt',
    'name',
    'company',
    'status',
    'day1SentAt',
    'day4SentAt',
    'day9SentAt',
    'repliedAt',
  ]);
  if (!allowed.has(field)) return { createdAt: 'desc' };
  return { [field]: dir === 'asc' ? 'asc' : 'desc' };
}

function coerceDate(value) {
  if (value === null) return null;
  if (value === undefined || value === '') return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    const err = new Error('Invalid date value');
    err.status = 400;
    throw err;
  }
  return d;
}

function serialize(contact) {
  if (!contact) return null;
  return {
    ...contact,
    followUpDates: contact.followUpDates || null,
    day1SentAt: contact.day1SentAt ? contact.day1SentAt.toISOString() : null,
    day4SentAt: contact.day4SentAt ? contact.day4SentAt.toISOString() : null,
    day9SentAt: contact.day9SentAt ? contact.day9SentAt.toISOString() : null,
    repliedAt: contact.repliedAt ? contact.repliedAt.toISOString() : null,
    createdAt: contact.createdAt.toISOString(),
    updatedAt: contact.updatedAt.toISOString(),
  };
}

function serializeSeqContact(contact, template = null) {
  const base = {
    id: contact.id,
    name: contact.name,
    firstName: contact.firstName,
    lastName: contact.lastName,
    email: contact.email,
    company: contact.company,
    domain: contact.domain,
    title: contact.title,
    country: contact.country,
    track: contact.track,
    status: contact.status,
    industryId: contact.industryId || null,
    templateSubject: null,
    templateBody: null,
    templateType: null,
  };
  if (template) {
    const { renderTemplate } = require('../lib/outreach');
    base.templateSubject = renderTemplate(template.subject, contact);
    base.templateBody = renderTemplate(template.body, contact);
    base.templateType = template.templateType || 'ai';
  }
  return base;
}

function prevSentAt(contact, prevFollowUpNum) {
  const dates =
    contact.followUpDates && typeof contact.followUpDates === 'object'
      ? contact.followUpDates
      : {};
  const key = String(prevFollowUpNum);
  if (dates[key]) return new Date(dates[key]);
  if (prevFollowUpNum === 1 && contact.day1SentAt) return contact.day1SentAt;
  if (prevFollowUpNum === 2 && contact.day4SentAt) return contact.day4SentAt;
  if (prevFollowUpNum === 3 && contact.day9SentAt) return contact.day9SentAt;
  return null;
}

async function resolveCadence(industryId) {
  if (industryId) {
    const ic = await prisma.industryConfig.findUnique({
      where: { industryId },
    });
    if (ic) {
      return {
        source: 'industry',
        cadenceDays: normalizeCadence(ic.cadenceDays),
      };
    }
  }
  const config = await prisma.outreachConfig.findUnique({ where: { id: 1 } });
  return {
    source: 'global',
    cadenceDays: normalizeCadence(config?.cadenceDays ?? DEFAULT_CADENCE),
  };
}

/** POST /api/contacts/apollo-search — gated by global kill switch */
router.post(
  '/apollo-search',
  asyncHandler(async (_req, res) => {
    const config = await prisma.outreachConfig.findFirst();
    if (!config?.systemEnabled) {
      return res.status(503).json({ error: 'System paused' });
    }
    return jsonError(
      res,
      400,
      'Apollo search requires an industry. Use POST /api/industries/:id/contacts/apollo-search',
    );
  }),
);

/** GET /api/contacts/sequence-ready — n8n batching for workflow 03 */
router.get(
  '/sequence-ready',
  asyncHandler(async (req, res) => {
    const config = await prisma.outreachConfig.findFirst();
    if (!config?.systemEnabled) {
      return res.json({ groups: [], totalContacts: 0, paused: true });
    }

    const track = req.query.track ? String(req.query.track) : null;
    const industryId = req.query.industryId
      ? String(req.query.industryId)
      : req.query.industry
        ? String(req.query.industry)
        : null;

    let resolvedIndustryId = industryId;
    if (industryId && !industryId.startsWith('c') && industryId.length < 30) {
      // allow slug
      const ind = await prisma.industry.findFirst({
        where: { OR: [{ id: industryId }, { slug: industryId }] },
      });
      resolvedIndustryId = ind?.id || industryId;
    }

    const { cadenceDays, source } = await resolveCadence(resolvedIndustryId);
    const activeDays = cadenceDays.filter((d) => d !== null);
    const now = new Date();
    const groups = [];
    const templateCache = new Map();

    async function templateFor(indId, followUpNum) {
      if (!indId) return null;
      const key = `${indId}:${followUpNum}`;
      if (templateCache.has(key)) return templateCache.get(key);
      const t = await prisma.emailTemplate.findUnique({
        where: {
          industryId_followUpNum: { industryId: indId, followUpNum },
        },
      });
      templateCache.set(key, t && t.isActive ? t : null);
      return templateCache.get(key);
    }

    const baseWhere = {
      ...(track ? { track: { contains: track } } : {}),
      ...(resolvedIndustryId ? { industryId: resolvedIndustryId } : {}),
    };

    for (let i = 0; i < activeDays.length; i++) {
      const followUpNum = i + 1;
      const dayInSequence = activeDays[i];
      let contacts = [];

      if (i === 0) {
        contacts = await prisma.contact.findMany({
          where: { status: 'Email Found', ...baseWhere },
          take: 60,
        });
      } else {
        // Completed previous step: Follow{i} Sent (+ legacy Day1/Day4/Day9)
        const prevStatuses = statusesCompletedFollowUp(i);
        const gapDays = activeDays[i] - activeDays[i - 1];
        const cutoffDate = new Date(now.getTime() - gapDays * 24 * 60 * 60 * 1000);
        const candidates = await prisma.contact.findMany({
          where: { status: { in: prevStatuses }, ...baseWhere },
          take: 60,
        });
        contacts = candidates.filter((c) => {
          const sentAt = prevSentAt(c, i);
          if (!sentAt) return false;
          return sentAt <= cutoffDate;
        });
      }

      if (contacts.length > 0) {
        const enriched = [];
        for (const c of contacts) {
          const tmpl = await templateFor(c.industryId, followUpNum);
          enriched.push(serializeSeqContact(c, tmpl));
        }
        groups.push({
          followUpNum,
          dayInSequence,
          contacts: enriched,
        });
      }
    }

    res.json({
      groups,
      activeDays,
      cadenceSource: source,
      totalContacts: groups.reduce((sum, g) => sum + g.contacts.length, 0),
    });
  }),
);

/** GET /api/contacts */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const {
      status,
      status_in: statusIn,
      email,
      domain,
      name,
      track,
      industryId: industryQ,
      limit,
      sort,
    } = req.query;

    const where = {};
    if (status === 'all_followups') {
      where.status = { in: FOLLOW_STATUSES };
    } else if (status) {
      where.status = String(status);
    }
    if (statusIn) {
      where.status = {
        in: String(statusIn)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      };
    }
    if (email) where.email = String(email).trim().toLowerCase();
    if (domain) where.domain = String(domain).trim().toLowerCase();
    if (name) where.name = String(name).trim();
    if (track) where.track = { contains: String(track) };
    if (industryQ) where.industryId = String(industryQ);

    const take = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 1000);
    const orderBy = parseSort(sort);

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({ where, orderBy, take }),
      prisma.contact.count({ where }),
    ]);

    res.json({ contacts: contacts.map(serialize), total });
  }),
);

/** GET /api/contacts/:id */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const contact = await prisma.contact.findUnique({
      where: { id: req.params.id },
    });
    if (!contact) return jsonError(res, 404, 'Contact not found');
    res.json({ contact: serialize(contact) });
  }),
);

/** POST /api/contacts */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const name = String(body.name || '').trim();
    const firstName = String(body.firstName || '').trim();
    const lastName = String(body.lastName || '').trim();
    const domain = String(body.domain || '')
      .trim()
      .toLowerCase();

    if (!name || !domain) {
      return jsonError(res, 400, 'name and domain are required');
    }
    if (!firstName || !lastName) {
      return jsonError(res, 400, 'firstName and lastName are required');
    }

    const status = body.status ? String(body.status) : 'Queue';
    if (!STATUSES.includes(status)) {
      return jsonError(res, 400, 'Invalid status. Use: ' + STATUSES.join(', '));
    }

    const emailRaw = body.email != null ? String(body.email).trim() : '';
    const contact = await prisma.contact.create({
      data: {
        name,
        firstName,
        lastName,
        email: emailRaw ? emailRaw.toLowerCase() : null,
        company: body.company != null ? String(body.company).trim() : null,
        domain,
        title: body.title != null ? String(body.title).trim() : null,
        country: body.country != null ? String(body.country).trim() : null,
        track: body.track != null ? String(body.track).trim() : null,
        status,
        source: body.source != null ? String(body.source).trim() : 'Apollo',
        allPermutations:
          body.allPermutations != null ? String(body.allPermutations) : null,
        followUpDates: body.followUpDates || undefined,
        day1SentAt: coerceDate(body.day1SentAt),
        day4SentAt: coerceDate(body.day4SentAt),
        day9SentAt: coerceDate(body.day9SentAt),
        repliedAt: coerceDate(body.repliedAt),
      },
    });

    res.status(201).json({ contact: serialize(contact) });
  }),
);

/** PATCH /api/contacts/:id */
router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const existing = await prisma.contact.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) return jsonError(res, 404, 'Contact not found');

    const data = {};

    // n8n V2 send update: { status, followUpNum, sentAt }
    const followUpNum = body.followUpNum != null ? Number.parseInt(body.followUpNum, 10) : null;
    if (Number.isInteger(followUpNum) && followUpNum >= 1 && body.sentAt) {
      const sentAt = coerceDate(body.sentAt);
      if (!sentAt) return jsonError(res, 400, 'Invalid sentAt');

      const dates =
        existing.followUpDates && typeof existing.followUpDates === 'object'
          ? { ...existing.followUpDates }
          : {};
      dates[String(followUpNum)] = sentAt.toISOString();
      data.followUpDates = dates;

      if (followUpNum === 1) data.day1SentAt = sentAt;
      if (followUpNum === 2) data.day4SentAt = sentAt;
      if (followUpNum === 3) data.day9SentAt = sentAt;

      if (body.status != null) {
        const st = normalizeStatus(body.status);
        if (!STATUSES.includes(st)) {
          return jsonError(res, 400, 'Invalid status. Use: ' + STATUSES.join(', '));
        }
        data.status = st;
      } else {
        data.status = `Follow${followUpNum} Sent`;
      }

      const contact = await prisma.contact.update({
        where: { id: req.params.id },
        data,
      });

      await prisma.emailLog.create({
        data: {
          contactId: contact.id,
          followUpNum,
          track: contact.track,
          industryId: body.industryId || contact.industryId || null,
          sentAt,
        },
      });

      return res.json({ contact: serialize(contact) });
    }

    for (const [key, value] of Object.entries(body)) {
      if (!UPDATABLE.has(key)) continue;
      if (
        key === 'day1SentAt' ||
        key === 'day4SentAt' ||
        key === 'day9SentAt' ||
        key === 'repliedAt'
      ) {
        const d = coerceDate(value);
        if (d !== undefined) data[key] = d;
        continue;
      }
      if (key === 'followUpDates') {
        data.followUpDates = value;
        continue;
      }
      if (key === 'status') {
        const st = normalizeStatus(value);
        if (!STATUSES.includes(st)) {
          return jsonError(res, 400, 'Invalid status. Use: ' + STATUSES.join(', '));
        }
        data.status = st;
        continue;
      }
      if (key === 'email') {
        data.email =
          value == null || value === '' ? null : String(value).trim().toLowerCase();
        continue;
      }
      if (key === 'domain') {
        data.domain = String(value).trim().toLowerCase();
        continue;
      }
      if (value === null) {
        data[key] = null;
      } else if (value !== undefined) {
        data[key] = String(value);
      }
    }

    if (!Object.keys(data).length) {
      return jsonError(res, 400, 'No updatable fields provided');
    }

    const contact = await prisma.contact.update({
      where: { id: req.params.id },
      data,
    });

    res.json({ contact: serialize(contact) });
  }),
);

module.exports = router;
module.exports.STATUSES = STATUSES;
