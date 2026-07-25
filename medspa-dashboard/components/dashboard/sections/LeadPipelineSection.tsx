"use client";

import { FunnelChart } from "@/components/dashboard/charts/FunnelChart";
import { LeadSourcePieChart } from "@/components/dashboard/charts/LeadSourcePieChart";
import { LeadsByHourChart } from "@/components/dashboard/charts/LeadsByHourChart";
import { MonthlyLeadsChart } from "@/components/dashboard/charts/MonthlyLeadsChart";
import { ResponseTimeChart } from "@/components/dashboard/charts/ResponseTimeChart";
import { SectionReveal } from "@/components/dashboard/SectionReveal";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { DashboardData } from "@/types/dashboard";

export function LeadPipelineSection({ data }: { data: DashboardData }) {
  const { leadPipeline, spa, kpis } = data;
  const afterHoursAppts = Math.round(
    (leadPipeline.afterHoursLeadShare / 100) *
      kpis.totalLeads *
      (kpis.leadToBookingRate / 100)
  );

  return (
    <SectionReveal id="lead-pipeline">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Lead Pipeline</h2>
        <p className="mt-1 text-sm text-text-secondary">
          How leads flow from inquiry to appointment
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <FunnelChart data={leadPipeline.funnel} />
        </div>
        <div className="lg:col-span-2">
          <LeadSourcePieChart data={leadPipeline.leadsBySource} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ResponseTimeChart
          data={leadPipeline.responseTimeDistribution}
          contactedWithin60sPct={leadPipeline.contactedWithin60sPct}
        />
        <LeadsByHourChart
          data={leadPipeline.leadsByHour}
          afterHoursLeadShare={leadPipeline.afterHoursLeadShare}
        />
      </div>

      <MonthlyLeadsChart
        data={leadPipeline.monthlyTrend}
        title="Leads vs bookings over time"
      />

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-5 text-sm leading-relaxed text-text-secondary">
          <span className="font-semibold text-text-primary">Insight: </span>
          Your automation captures leads 24/7.{" "}
          {leadPipeline.afterHoursLeadShare}% of inquiries arrive outside business
          hours — these were previously missed. At your booking rate, that&apos;s ~
          {afterHoursAppts} additional appointments per month
          {spa.avgTicketValue
            ? ` (~${formatCurrency(afterHoursAppts * spa.avgTicketValue)} potential).`
            : "."}
        </CardContent>
      </Card>
    </SectionReveal>
  );
}
