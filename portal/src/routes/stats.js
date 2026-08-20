const express = require('express');
const { prisma } = require('../db');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

function startOfUtcDay(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function startOfUtcWeek(d = new Date()) {
  const day = d.getUTCDay(); // 0 Sun
  const diff = (day + 6) % 7; // Monday start
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - diff);
  return monday;
}

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const today = startOfUtcDay();
    const week = startOfUtcWeek();

    const [byStatus, byTrack, total, day1Today, day4Today, day9Today, repliesWeek] =
      await Promise.all([
        prisma.contact.groupBy({ by: ['status'], _count: { _all: true } }),
        prisma.contact.groupBy({ by: ['track'], _count: { _all: true } }),
        prisma.contact.count(),
        prisma.contact.count({ where: { day1SentAt: { gte: today } } }),
        prisma.contact.count({ where: { day4SentAt: { gte: today } } }),
        prisma.contact.count({ where: { day9SentAt: { gte: today } } }),
        prisma.contact.count({ where: { repliedAt: { gte: week } } }),
      ]);

    res.json({
      total,
      byStatus: byStatus.map((r) => ({
        status: r.status,
        count: r._count._all,
      })),
      byTrack: byTrack.map((r) => ({
        track: r.track || 'Unspecified',
        count: r._count._all,
      })),
      emailsSentToday: {
        day1: day1Today,
        day4: day4Today,
        day9: day9Today,
        total: day1Today + day4Today + day9Today,
      },
      repliesThisWeek: repliesWeek,
    });
  }),
);

module.exports = router;
