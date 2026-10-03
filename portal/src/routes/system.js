const express = require('express');
const { prisma } = require('../db');
const { asyncHandler, jsonError } = require('../middleware/errorHandler');
const { DEFAULT_CADENCE } = require('../lib/outreach');

const router = express.Router();

/** POST /api/system/toggle — body { enabled: boolean } */
router.post(
  '/toggle',
  asyncHandler(async (req, res) => {
    if (typeof req.body?.enabled !== 'boolean') {
      return jsonError(res, 400, 'Body must include { enabled: boolean }');
    }

    const updated = await prisma.outreachConfig.upsert({
      where: { id: 1 },
      create: {
        cadenceDays: DEFAULT_CADENCE,
        systemEnabled: req.body.enabled,
      },
      update: { systemEnabled: req.body.enabled },
    });

    res.json({ systemEnabled: Boolean(updated.systemEnabled) });
  }),
);

module.exports = router;
