const express = require('express');
const { prisma } = require('../db');
const { asyncHandler, jsonError } = require('../middleware/errorHandler');
const {
  DEFAULT_CADENCE,
  normalizeCadence,
  parseCadenceDays,
} = require('../lib/outreach');

const router = express.Router();

function serialize(config) {
  return {
    cadenceDays: normalizeCadence(config.cadenceDays),
    updatedAt: config.updatedAt.toISOString(),
  };
}

/** GET /api/config */
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const config = await prisma.outreachConfig.upsert({
      where: { id: 1 },
      create: { cadenceDays: DEFAULT_CADENCE },
      update: {},
    });
    res.json(serialize(config));
  }),
);

/** PUT /api/config */
router.put(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = parseCadenceDays(req.body?.cadenceDays);
    if (parsed.error) return jsonError(res, 400, parsed.error);

    const updated = await prisma.outreachConfig.upsert({
      where: { id: 1 },
      create: { cadenceDays: parsed.days },
      update: { cadenceDays: parsed.days },
    });
    res.json(serialize(updated));
  }),
);

module.exports = router;
