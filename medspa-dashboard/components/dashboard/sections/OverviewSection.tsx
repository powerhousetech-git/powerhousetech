"use client";

import {
  CalendarCheck,
  DollarSign,
  Star,
  UserCheck,
  Users,
  Zap,
} from "lucide-react";
import { MonthlyLeadsChart } from "@/components/dashboard/charts/MonthlyLeadsChart";
import { SectionReveal } from "@/components/dashboard/SectionReveal";
import { AlertBanner } from "@/components/dashboard/widgets/AlertBanner";
import { KPICard } from "@/components/dashboard/widgets/KPICard";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatPct } from "@/lib/utils";
import type { DashboardData } from "@/types/dashboard";

export function OverviewSection({ data }: { data: DashboardData }) {
  const highRisk = data.appointments.upcomingAtRisk.filter(
    (a) => a.riskLevel === "high"
  ).length;
  const { kpis, leadPipeline } = data;

  return (
    <SectionReveal id="overview">
      {highRisk > 0 && (
        <AlertBanner
          message={`${highRisk} high-risk appointments haven't confirmed. View at-risk list →`}
          detail="Confirmation gaps and prior no-shows raise tomorrow's revenue risk."
          scrollToId="appointments"
        />
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <KPICard
          title="Total Leads"
          value={kpis.totalLeads}
          change={kpis.totalLeadsChangePct}
          icon={Users}
          iconColor="#424FD1"
          animate
          tooltip="Inquiries captured across all channels in this period."
        />
        <KPICard
          title="Avg Response Time"
          value={`${kpis.avgResponseTimeSeconds} sec`}
          change={Math.abs(kpis.avgResponseTimeChangePct)}
          changeLabel="faster vs before"
          icon={Zap}
          iconColor="#F59E0B"
          highlight
          tooltip={`Was ${kpis.previousAvgResponseMinutes} min before automation`}
        />
        <KPICard
          title="Booking Rate"
          value={formatPct(kpis.leadToBookingRate)}
          change={kpis.leadToBookingRateChangePct}
          icon={CalendarCheck}
          iconColor="#22C55E"
          tooltip="Share of leads that booked an appointment."
        />
        <KPICard
          title="Show Rate"
          value={formatPct(kpis.appointmentShowRate)}
          change={kpis.appointmentShowRateChangePct}
          icon={UserCheck}
          iconColor="#22C55E"
          tooltip="Booked appointments that arrived."
        />
        <KPICard
          title="Reviews Generated"
          value={kpis.reviewsGenerated}
          change={kpis.reviewsGeneratedChangePct}
          icon={Star}
          iconColor="#FACC15"
          animate
          tooltip="New Google/Yelp reviews attributed to automated requests."
        />
        <KPICard
          title="Revenue Recovered"
          value={formatCurrency(kpis.estimatedRevenueRecovered)}
          change={kpis.estimatedRevenueRecoveredChangePct ?? undefined}
          changeLabel={
            kpis.estimatedRevenueRecoveredChangePct == null
              ? "new metric"
              : "vs prior period"
          }
          icon={DollarSign}
          iconColor="#22C55E"
          highlight
          tooltip="Estimated value from no-show recovery, reactivation, and after-hours leads."
        />
      </div>

      <MonthlyLeadsChart data={leadPipeline.monthlyTrend} />

      <Card className="border-primary/30 bg-gradient-to-r from-primary/15 via-surface to-surface shadow-glow">
        <CardContent className="flex flex-col gap-2 p-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-3xl font-bold tracking-tight text-primary-light sm:text-4xl">
              {leadPipeline.contactedWithin60sPct}% of leads contacted in &lt;60 seconds
            </p>
            <p className="mt-2 text-sm text-text-secondary">
              Before automation: avg {kpis.previousAvgResponseMinutes} minutes
            </p>
          </div>
          <Zap className="h-10 w-10 text-accent-amber opacity-80" />
        </CardContent>
      </Card>
    </SectionReveal>
  );
}
