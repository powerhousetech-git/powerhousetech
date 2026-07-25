"use client";

import { NoShowTrendChart } from "@/components/dashboard/charts/NoShowTrendChart";
import { ReminderEffectivenessChart } from "@/components/dashboard/charts/ReminderEffectivenessChart";
import { ShowRateByTreatmentChart } from "@/components/dashboard/charts/ShowRateByTreatmentChart";
import { SectionReveal } from "@/components/dashboard/SectionReveal";
import { AlertBanner } from "@/components/dashboard/widgets/AlertBanner";
import { UpcomingNoShowRisk } from "@/components/dashboard/widgets/UpcomingNoShowRisk";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatPct } from "@/lib/utils";
import type { DashboardData } from "@/types/dashboard";

export function AppointmentsSection({ data }: { data: DashboardData }) {
  const { appointments } = data;
  const highRisk = appointments.upcomingAtRisk.filter(
    (a) => a.riskLevel === "high"
  ).length;
  const belowAvg =
    appointments.industryNoShowRate - appointments.currentNoShowRate;

  return (
    <SectionReveal id="appointments">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          Appointments & No-Shows
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Reminder automation and at-risk booking visibility
        </p>
      </div>

      {highRisk > 0 && (
        <AlertBanner
          message={`${highRisk} high-risk appointments tomorrow haven't confirmed. View at-risk list →`}
          scrollToId="upcoming-no-show-risk"
        />
      )}

      <UpcomingNoShowRisk appointments={appointments.upcomingAtRisk} />

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <NoShowTrendChart data={appointments.noShowTrend} />
        </div>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>No-show snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs text-text-muted">Current no-show rate</p>
              <p className="font-mono text-3xl font-bold text-accent-green">
                {formatPct(appointments.currentNoShowRate)}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Industry average</p>
              <p className="font-mono text-2xl font-semibold text-text-secondary">
                {formatPct(appointments.industryNoShowRate)}
              </p>
            </div>
            <p className="text-sm text-text-secondary">
              You&apos;re{" "}
              <span className="font-semibold text-accent-green">
                {belowAvg.toFixed(1)} points below average
              </span>
            </p>
            <div className="rounded-xl border border-border bg-surface-hover/50 p-3">
              <p className="text-xs text-text-muted">
                Revenue saved this month from reduced no-shows
              </p>
              <p className="mt-1 font-mono text-xl font-bold text-accent-green">
                {formatCurrency(appointments.monthlyNoShowSavings)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ShowRateByTreatmentChart data={appointments.showRateByTreatment} />
        <ReminderEffectivenessChart data={appointments.reminderEffectiveness} />
      </div>
    </SectionReveal>
  );
}
