const express = require('express');
const { prisma } = require('../db');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

function groupByFollowUp(logs) {
  const out = {};
  for (const log of logs) {
    out[log.followUpNum] = (out[log.followUpNum] || 0) + 1;
  }
  return out;
}

function trackBreakdown(logs) {
  return {
    A: logs.filter((l) => (l.track || '').includes('Startups')).length,
    B: logs.filter((l) => (l.track || '').includes('EMS')).length,
  };
}

/** GET /api/stats — dashboard metrics */
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);

    const [statusCounts, todayLogs, weekLogs, allTimeLogs, recent, total] =
      await Promise.all([
        prisma.contact.groupBy({ by: ['status'], _count: { id: true } }),
        prisma.emailLog.findMany({ where: { sentAt: { gte: startOfToday } } }),
        prisma.emailLog.findMany({ where: { sentAt: { gte: startOfWeek } } }),
        prisma.emailLog.findMany({}),
        prisma.emailLog.findMany({
          orderBy: { sentAt: 'desc' },
          take: 20,
          include: {
            contact: { select: { name: true, company: true, track: true } },
          },
        }),
        prisma.contact.count(),
      ]);

    const pipeline = Object.fromEntries(
      statusCounts.map((s) => [s.status, s._count.id]),
    );
    const replied = pipeline.Replied || 0;
    const follow1All = allTimeLogs.filter((l) => l.followUpNum === 1).length;
    const replyRate = follow1All > 0 ? replied / follow1All : 0;

    const byTrack = await prisma.contact.groupBy({
      by: ['track'],
      _count: { id: true },
    });

    res.json({
      total,
      pipeline,
      byStatus: statusCounts.map((s) => ({
        status: s.status,
        count: s._count.id,
      })),
      byTrack: byTrack.map((r) => ({
        track: r.track || 'Unspecified',
        count: r._count.id,
      })),
      replyRate,
      emailVolume: {
        today: {
          byFollowUp: groupByFollowUp(todayLogs),
          total: todayLogs.length,
          byTrack: trackBreakdown(todayLogs),
        },
        thisWeek: {
          byFollowUp: groupByFollowUp(weekLogs),
          total: weekLogs.length,
          byTrack: trackBreakdown(weekLogs),
        },
        allTime: {
          byFollowUp: groupByFollowUp(allTimeLogs),
          total: allTimeLogs.length,
          byTrack: trackBreakdown(allTimeLogs),
        },
      },
      recentSends: recent.map((l) => ({
        contactName: l.contact?.name || '—',
        company: l.contact?.company || null,
        track: l.contact?.track || l.track || null,
        followUpNum: l.followUpNum,
        sentAt: l.sentAt.toISOString(),
      })),
      // Back-compat for older stats page snippets
      emailsSentToday: {
        total: todayLogs.length,
        day1: todayLogs.filter((l) => l.followUpNum === 1).length,
        day4: todayLogs.filter((l) => l.followUpNum === 2).length,
        day9: todayLogs.filter((l) => l.followUpNum === 3).length,
      },
      repliesThisWeek: replied,
    });
  }),
);

module.exports = router;
