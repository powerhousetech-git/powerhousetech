const express = require('express');
const { prisma } = require('../db');
const { asyncHandler, jsonError } = require('../middleware/errorHandler');

const router = express.Router();

const STATUSES = [
  'Queue',
  'Email Found',
  'Day1 Sent',
  'Day4 Sent',
  'Day9 Sent',
  'Replied',
  'Bounced',
  'Unsubscribed',
];

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
    day1SentAt: contact.day1SentAt ? contact.day1SentAt.toISOString() : null,
    day4SentAt: contact.day4SentAt ? contact.day4SentAt.toISOString() : null,
    day9SentAt: contact.day9SentAt ? contact.day9SentAt.toISOString() : null,
    repliedAt: contact.repliedAt ? contact.repliedAt.toISOString() : null,
    createdAt: contact.createdAt.toISOString(),
    updatedAt: contact.updatedAt.toISOString(),
  };
}

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
      limit,
      sort,
    } = req.query;

    const where = {};
    if (status) where.status = String(status);
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
    if (track) where.track = String(track);

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
    const data = {};

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
      if (key === 'status') {
        if (!STATUSES.includes(String(value))) {
          return jsonError(res, 400, 'Invalid status. Use: ' + STATUSES.join(', '));
        }
        data.status = String(value);
        continue;
      }
      if (key === 'email') {
        const e = value == null || value === '' ? null : String(value).trim().toLowerCase();
        data.email = e;
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
