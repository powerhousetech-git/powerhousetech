const express = require('express');
const { prisma } = require('../db');
const { asyncHandler, jsonError } = require('../middleware/errorHandler');

const router = express.Router();

function serialize(config) {
  return {
    sequenceDay1: config.sequenceDay1,
    sequenceDay2: config.sequenceDay2,
    sequenceDay3: config.sequenceDay3,
    updatedAt: config.updatedAt.toISOString(),
  };
}

function parseCadence(body) {
  const d1 = Number.parseInt(body?.sequenceDay1, 10);
  const d2 = Number.parseInt(body?.sequenceDay2, 10);
  const d3 = Number.parseInt(body?.sequenceDay3, 10);

  if (!Number.isInteger(d1) || !Number.isInteger(d2) || !Number.isInteger(d3)) {
    return { error: 'All values must be integers.' };
  }
  if (d1 < 1 || d2 < 1 || d3 < 1) {
    return { error: 'All values must be positive.' };
  }
  if (d1 !== 1) {
    return { error: 'sequenceDay1 must equal 1 (initial send is always Day 1).' };
  }
  if (!(d1 < d2 && d2 < d3)) {
    return {
      error: 'Days must be in strictly ascending order (Day 1 < Day 2 < Day 3).',
    };
  }
  return { d1, d2, d3 };
}

/** GET /api/config — cadence used by n8n workflow 03 */
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const config = await prisma.outreachConfig.upsert({
      where: { id: 1 },
      create: {},
      update: {},
    });
    res.json(serialize(config));
  }),
);

/** PUT /api/config — update cadence from Controls page */
router.put(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = parseCadence(req.body || {});
    if (parsed.error) return jsonError(res, 400, parsed.error);

    const updated = await prisma.outreachConfig.upsert({
      where: { id: 1 },
      create: {
        sequenceDay1: parsed.d1,
        sequenceDay2: parsed.d2,
        sequenceDay3: parsed.d3,
      },
      update: {
        sequenceDay1: parsed.d1,
        sequenceDay2: parsed.d2,
        sequenceDay3: parsed.d3,
      },
    });
    res.json(serialize(updated));
  }),
);

module.exports = router;
