"use client";

import { ReactivationTrendChart } from "@/components/dashboard/charts/ReactivationTrendChart";
import { SectionReveal } from "@/components/dashboard/SectionReveal";
import { CampaignTable } from "@/components/dashboard/widgets/CampaignTable";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatNumber, formatPct } from "@/lib/utils";
import type { DashboardData } from "@/types/dashboard";

const statusVariant = {
  reached: "success",
  pending: "warning",
  "not-reached": "danger",
} as const;

export function ReactivationSection({ data }: { data: DashboardData }) {
  const { reactivation, spa } = data;

  return (
    <SectionReveal id="reactivation">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          Patient Reactivation
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Patients who haven&apos;t visited recently, automatically re-engaged
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-text-muted">Total reactivated</p>
            <p className="mt-1 font-mono text-3xl font-bold">
              {formatNumber(reactivation.totalReactivated)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-text-muted">Revenue from reactivation</p>
            <p className="mt-1 font-mono text-3xl font-bold text-accent-green">
              {formatCurrency(reactivation.totalRevenue)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-text-muted">Avg booking rate</p>
            <p className="mt-1 font-mono text-3xl font-bold">
              {formatPct(reactivation.avgBookingRate)}
            </p>
          </CardContent>
        </Card>
      </div>

      <CampaignTable campaigns={reactivation.campaigns} />

      <Card>
        <CardHeader>
          <CardTitle>Lapsed patient buckets</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0 sm:px-5 sm:pb-5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Days lapsed</TableHead>
                <TableHead>Patients</TableHead>
                <TableHead>Est. revenue</TableHead>
                <TableHead>Reach status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reactivation.lapsedPatientBuckets.map((b) => (
                <TableRow key={b.daysLapsed}>
                  <TableCell className="font-medium">{b.daysLapsed}</TableCell>
                  <TableCell className="font-mono">
                    {formatNumber(b.patientCount)}
                  </TableCell>
                  <TableCell className="font-mono">
                    {formatCurrency(b.estimatedRevenue)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[b.reachStatus]}>
                      {b.reachStatus}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ReactivationTrendChart data={reactivation.monthlyReactivation} />

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-5 text-sm leading-relaxed text-text-secondary">
          <span className="font-semibold text-text-primary">Insight: </span>
          {formatNumber(reactivation.dormant90PlusCount)} patients haven&apos;t
          visited in 90+ days. At your average ticket of{" "}
          {formatCurrency(spa.avgTicketValue)}, that&apos;s{" "}
          {formatCurrency(reactivation.dormant90PlusRevenue)} in dormant revenue.
          Your active win-back campaigns are working through this list.
        </CardContent>
      </Card>
    </SectionReveal>
  );
}
