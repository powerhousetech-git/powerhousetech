import { CHART_COLORS } from "@/lib/utils";
import type { DashboardData, DateRange } from "@/types/dashboard";

function scaleForRange(range: DateRange): number {
  if (range === "60d") return 1.85;
  if (range === "90d") return 2.6;
  return 1;
}

export function getMockDashboardData(
  slug: string,
  dateRange: DateRange = "30d"
): DashboardData {
  const s = scaleForRange(dateRange);
  const spaName =
    slug === "demo" || slug === "luxe-glow"
      ? "Luxe Glow Med Spa"
      : slug
          .split("-")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");

  const totalLeads = Math.round(147 * s);
  const booked = Math.round(50 * s);
  const showed = Math.round(44 * s);
  const contacted = totalLeads;
  const replied = Math.round(89 * s);

  return {
    spa: {
      name: spaName,
      location: "Miami, FL",
      ownerName: "Dr. Sarah Chen",
      avgTicketValue: 285,
      monthlyAppointmentVolume: 180,
      automationStartDate: "2026-04-01",
      buildCost: 2000,
      monthlyRetainer: 350,
    },
    kpis: {
      totalLeads,
      totalLeadsChangePct: 23,
      avgResponseTimeSeconds: 48,
      avgResponseTimeChangePct: -96,
      leadToBookingRate: 34,
      leadToBookingRateChangePct: 18,
      appointmentShowRate: 88.2,
      appointmentShowRateChangePct: 12,
      reviewsGenerated: Math.round(43 * Math.min(s, 1.4)),
      reviewsGeneratedChangePct: 340,
      estimatedRevenueRecovered: Math.round(12840 * s),
      estimatedRevenueRecoveredChangePct: null,
      previousAvgResponseMinutes: 42,
    },
    leadPipeline: {
      funnel: [
        {
          stage: "Leads Received",
          count: totalLeads,
          percentage: 100,
          dropOffPct: 0,
          beforeCount: Math.round(88 * s),
        },
        {
          stage: "Contacted",
          count: contacted,
          percentage: 100,
          dropOffPct: 0,
          beforeCount: Math.round(52 * s),
        },
        {
          stage: "Replied",
          count: replied,
          percentage: Math.round((replied / totalLeads) * 100),
          dropOffPct: Math.round(((contacted - replied) / contacted) * 100),
          beforeCount: Math.round(31 * s),
        },
        {
          stage: "Booked",
          count: booked,
          percentage: Math.round((booked / totalLeads) * 100),
          dropOffPct: Math.round(((replied - booked) / replied) * 100),
          beforeCount: Math.round(21 * s),
        },
        {
          stage: "Showed",
          count: showed,
          percentage: Math.round((showed / booked) * 100),
          dropOffPct: Math.round(((booked - showed) / booked) * 100),
          beforeCount: Math.round(16 * s),
        },
      ],
      responseTimeDistribution: [
        { bucket: "<1 min", count: Math.round(139 * s), isTarget: true },
        { bucket: "1-5 min", count: Math.round(5 * s), isTarget: false },
        { bucket: "5-30 min", count: Math.round(2 * s), isTarget: false },
        { bucket: "30m-1h", count: Math.round(1 * s), isTarget: false },
        { bucket: ">1 hour", count: 0, isTarget: false },
      ],
      leadsBySource: [
        {
          source: "Meta Ads",
          count: Math.round(58 * s),
          percentage: 39,
          color: CHART_COLORS[0],
        },
        {
          source: "Web Form",
          count: Math.round(41 * s),
          percentage: 28,
          color: CHART_COLORS[1],
        },
        {
          source: "Missed Call",
          count: Math.round(29 * s),
          percentage: 20,
          color: CHART_COLORS[2],
        },
        {
          source: "Google",
          count: Math.round(13 * s),
          percentage: 9,
          color: CHART_COLORS[3],
        },
        {
          source: "Instagram DM",
          count: Math.round(6 * s),
          percentage: 4,
          color: CHART_COLORS[4],
        },
      ],
      leadsByHour: Array.from({ length: 24 }, (_, hour) => {
        const peaks: Record<number, number> = {
          9: 4,
          10: 6,
          11: 7,
          12: 5,
          13: 6,
          14: 8,
          15: 7,
          16: 6,
          17: 5,
          18: 8,
          19: 10,
          20: 12,
          21: 18,
          22: 15,
          23: 9,
          0: 3,
          1: 2,
          7: 3,
          8: 4,
        };
        const count = Math.round((peaks[hour] ?? 1) * Math.max(1, s * 0.55));
        const isAfterHours = hour >= 18 || hour <= 7;
        return { hour, count, isAfterHours };
      }),
      monthlyTrend: [
        { month: "Jan", leads: 85, booked: 22 },
        { month: "Feb", leads: 91, booked: 24 },
        { month: "Mar", leads: 88, booked: 21 },
        { month: "Apr", leads: 118, booked: 36 },
        { month: "May", leads: 131, booked: 43 },
        { month: "Jun", leads: 147, booked: 50 },
      ],
      afterHoursLeadShare: 47,
      contactedWithin60sPct: 96,
    },
    appointments: {
      noShowTrend: [
        { month: "Jan", noShowRate: 19, industry: 17.5 },
        { month: "Feb", noShowRate: 18, industry: 17.8 },
        { month: "Mar", noShowRate: 20, industry: 17.6 },
        { month: "Apr", noShowRate: 15, industry: 17.4 },
        { month: "May", noShowRate: 13, industry: 17.5 },
        { month: "Jun", noShowRate: 11.8, industry: 17.4 },
      ],
      showRateByTreatment: [
        { treatment: "Botox", showRate: 91, appointmentCount: 67 },
        { treatment: "Filler", showRate: 88, appointmentCount: 29 },
        { treatment: "HydraFacial", showRate: 89, appointmentCount: 28 },
        { treatment: "CoolSculpting", showRate: 84, appointmentCount: 12 },
        { treatment: "Laser", showRate: 86, appointmentCount: 9 },
      ],
      reminderEffectiveness: [
        {
          touchpoint: "No automation (before)",
          confirmationRate: 45,
          showRate: 76,
        },
        {
          touchpoint: "Confirmation only",
          confirmationRate: 62,
          showRate: 82,
        },
        {
          touchpoint: "48h + morning-of",
          confirmationRate: 84,
          showRate: 88,
        },
      ],
      upcomingAtRisk: [
        {
          id: "1",
          initials: "K.L.",
          treatment: "Botox",
          appointmentDate: "Tomorrow",
          appointmentTime: "2:00 PM",
          riskLevel: "high",
          riskReason: "No confirmation reply",
          revenueAtRisk: 285,
        },
        {
          id: "2",
          initials: "M.R.",
          treatment: "CoolSculpting",
          appointmentDate: "Tomorrow",
          appointmentTime: "4:00 PM",
          riskLevel: "high",
          riskReason: "Previous no-show",
          revenueAtRisk: 850,
        },
        {
          id: "3",
          initials: "T.W.",
          treatment: "HydraFacial",
          appointmentDate: "In 2 days",
          appointmentTime: "11:00 AM",
          riskLevel: "medium",
          riskReason: "Booked >7 days ago",
          revenueAtRisk: 195,
        },
        {
          id: "4",
          initials: "A.P.",
          treatment: "Filler",
          appointmentDate: "In 3 days",
          appointmentTime: "3:00 PM",
          riskLevel: "low",
          riskReason: "Booked >14 days ago",
          revenueAtRisk: 650,
        },
      ],
      currentNoShowRate: 11.8,
      industryNoShowRate: 17.4,
      monthlyNoShowSavings: 3522,
    },
    reactivation: {
      campaigns: [
        {
          id: "c1",
          name: "Botox Day 75",
          type: "Recall",
          description: "Reaches Botox patients ~75 days after last treatment.",
          sent: 34,
          opened: 27,
          clicked: 19,
          booked: 11,
          revenue: 3135,
          openRate: 79,
          bookingRate: 32,
        },
        {
          id: "c2",
          name: "Filler Month 10",
          type: "Recall",
          description: "10-month filler maintenance reminder sequence.",
          sent: 18,
          opened: 14,
          clicked: 9,
          booked: 5,
          revenue: 2250,
          openRate: 78,
          bookingRate: 28,
        },
        {
          id: "c3",
          name: "Win-back 60 Day",
          type: "Win-back",
          description: "Re-engages patients quiet for 60 days.",
          sent: 52,
          opened: 31,
          clicked: 14,
          booked: 6,
          revenue: 1710,
          openRate: 60,
          bookingRate: 12,
        },
        {
          id: "c4",
          name: "Win-back 90 Day",
          type: "Win-back",
          description: "Stronger offer for 90-day lapsed patients.",
          sent: 41,
          opened: 21,
          clicked: 9,
          booked: 3,
          revenue: 855,
          openRate: 51,
          bookingRate: 7,
        },
        {
          id: "c5",
          name: "Final Offer 120 Day",
          type: "Win-back",
          description: "Last-touch campaign before deep dormancy.",
          sent: 28,
          opened: 11,
          clicked: 4,
          booked: 1,
          revenue: 285,
          openRate: 39,
          bookingRate: 4,
        },
      ].sort((a, b) => b.revenue - a.revenue),
      lapsedPatientBuckets: [
        {
          daysLapsed: "31-60 days",
          patientCount: 28,
          estimatedRevenue: 7980,
          reachStatus: "reached",
        },
        {
          daysLapsed: "61-90 days",
          patientCount: 19,
          estimatedRevenue: 5415,
          reachStatus: "reached",
        },
        {
          daysLapsed: "91-120 days",
          patientCount: 34,
          estimatedRevenue: 9690,
          reachStatus: "pending",
        },
        {
          daysLapsed: "120+ days",
          patientCount: 67,
          estimatedRevenue: 19095,
          reachStatus: "not-reached",
        },
      ],
      monthlyReactivation: [
        { month: "Apr", sent: 48, booked: 9, revenue: 1800 },
        { month: "May", sent: 72, booked: 14, revenue: 2900 },
        { month: "Jun", sent: 85, booked: 17, revenue: 3535 },
      ],
      totalReactivated: 26,
      totalRevenue: 8235,
      avgBookingRate: 15.4,
      dormant90PlusCount: 148,
      dormant90PlusRevenue: 42180,
    },
    reviews: {
      monthlyReviews: [
        { month: "Jan", requested: 8, received: 7, avgRating: 4.6 },
        { month: "Feb", requested: 9, received: 8, avgRating: 4.7 },
        { month: "Mar", requested: 11, received: 10, avgRating: 4.8 },
        { month: "Apr", requested: 38, received: 31, avgRating: 4.8 },
        { month: "May", requested: 43, received: 38, avgRating: 4.9 },
        { month: "Jun", requested: 48, received: 43, avgRating: 4.9 },
      ],
      requestSendRate: 94,
      conversionRate: 89,
      currentAvgRating: 4.9,
      previousAvgRating: 4.7,
      totalReviewsGenerated: Math.round(43 * Math.min(s, 1.4)),
      recentReviews: [
        {
          id: "r1",
          initials: "S.K.",
          rating: 5,
          text: "Absolutely loved my Botox appointment! The reminder texts were so helpful. Will definitely be back!",
          treatment: "Botox",
          daysAgo: 2,
          platform: "Google",
        },
        {
          id: "r2",
          initials: "M.L.",
          rating: 5,
          text: "The booking process was seamless and I got a confirmation right away. Great results!",
          treatment: "HydraFacial",
          daysAgo: 4,
          platform: "Google",
        },
        {
          id: "r3",
          initials: "R.T.",
          rating: 4,
          text: "Great experience overall, staff is wonderful. Treatment results are amazing.",
          treatment: "Filler",
          daysAgo: 6,
          platform: "Google",
        },
        {
          id: "r4",
          initials: "J.A.",
          rating: 5,
          text: "I've been going here for a year and the communication has improved so much. Love the follow-up texts!",
          treatment: "Laser",
          daysAgo: 8,
          platform: "Google",
        },
        {
          id: "r5",
          initials: "C.M.",
          rating: 5,
          text: "First time client — from the first response to my inquiry to after my appointment, everything was perfect.",
          treatment: "Botox",
          daysAgo: 10,
          platform: "Google",
        },
      ],
    },
    revenueImpact: {
      noShowRevenueRecovered: Math.round(8322 * Math.min(s, 1.5)),
      reactivationRevenue: Math.round(8235 * Math.min(s, 1.5)),
      afterHoursLeadsValue: Math.round(5738 * Math.min(s, 1.5)),
      reviewsEstimatedValue: Math.round(2100 * Math.min(s, 1.2)),
      totalROI: Math.round(24395 * Math.min(s, 1.5)),
      buildCost: 2000,
      monthlyRetainer: 350,
      totalInvestment: 3050,
      paybackDays: 8,
      roiMultiple: 7.9,
      monthlyBreakdown: [
        {
          month: "Apr",
          noShow: 2100,
          reactivation: 1800,
          afterHours: 1500,
          cumulative: 5400,
        },
        {
          month: "May",
          noShow: 2700,
          reactivation: 2900,
          afterHours: 2000,
          cumulative: 13000,
        },
        {
          month: "Jun",
          noShow: 3522,
          reactivation: 3535,
          afterHours: 2238,
          cumulative: 24395,
        },
      ],
    },
    lastUpdated: new Date().toISOString(),
    dateRange,
  };
}
