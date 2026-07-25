"use client";

import { ArrowRight, Clock, RefreshCw, Star, UserX } from "lucide-react";
import { ROIWaterfallChart } from "@/components/dashboard/charts/ROIWaterfallChart";
import { SectionReveal } from "@/components/dashboard/SectionReveal";
import { PaybackWidget } from "@/components/dashboard/widgets/PaybackWidget";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { calculateROI } from "@/lib/calculations";
import { formatCurrency, formatPct } from "@/lib/utils";
import type { DashboardData } from "@/types/dashboard";

export function RevenueImpactSection({ data }: { data: DashboardData }) {
  const { revenueImpact, spa } = data;
  const monthsRetainer = Math.max(
    1,
    Math.round(
      (revenueImpact.totalInvestment - revenueImpact.buildCost) /
        revenueImpact.monthlyRetainer
    )
  );
  const roiPct = calculateROI(
    revenueImpact.totalROI,
    revenueImpact.totalInvestment
  );
  const bookingUrl =
    process.env.NEXT_PUBLIC_BOOKING_URL || "https://cal.com/powerhousetech";

  const cards = [
    {
      title: "No-Show Recovery",
      value: revenueImpact.noShowRevenueRecovered,
      icon: UserX,
      color: "text-accent-green",
    },
    {
      title: "Reactivation Revenue",
      value: revenueImpact.reactivationRevenue,
      icon: RefreshCw,
      color: "text-primary-light",
    },
    {
      title: "After-Hours Leads",
      value: revenueImpact.afterHoursLeadsValue,
      icon: Clock,
      color: "text-accent-amber",
    },
    {
      title: "Reviews Value",
      value: revenueImpact.reviewsEstimatedValue,
      icon: Star,
      color: "text-yellow-400",
    },
  ];

  return (
    <SectionReveal id="revenue-impact">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Revenue Impact</h2>
        <p className="mt-1 text-sm text-text-secondary">
          The dollar value your automation system has generated
        </p>
      </div>

      <PaybackWidget
        paybackDays={revenueImpact.paybackDays}
        totalInvestment={revenueImpact.totalInvestment}
        totalROI={revenueImpact.totalROI}
        roiMultiple={revenueImpact.roiMultiple}
        buildCost={revenueImpact.buildCost}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ title, value, icon: Icon, color }) => (
          <Card key={title}>
            <CardContent className="flex items-start justify-between p-5">
              <div>
                <p className="text-xs text-text-muted">{title}</p>
                <p className={`mt-1 font-mono text-2xl font-bold ${color}`}>
                  {formatCurrency(value)}
                </p>
              </div>
              <Icon className={`h-5 w-5 ${color}`} />
            </CardContent>
          </Card>
        ))}
      </div>

      <ROIWaterfallChart data={revenueImpact.monthlyBreakdown} />

      <Card>
        <CardHeader>
          <CardTitle>Investment breakdown</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0 sm:px-5 sm:pb-5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Build (one-time)</TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(spa.buildCost)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>
                  Retainer × {monthsRetainer} months
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(spa.monthlyRetainer * monthsRetainer)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-semibold">Total invested</TableCell>
                <TableCell className="text-right font-mono font-semibold">
                  {formatCurrency(revenueImpact.totalInvestment)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-semibold text-accent-green">
                  Value recovered
                </TableCell>
                <TableCell className="text-right font-mono font-semibold text-accent-green">
                  {formatCurrency(revenueImpact.totalROI)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>ROI multiple</TableCell>
                <TableCell className="text-right font-mono">
                  {revenueImpact.roiMultiple.toFixed(1)}× (
                  {formatPct(roiPct, 0)})
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-primary/30 bg-gradient-to-br from-primary/15 to-transparent">
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-lg font-semibold tracking-tight">
              Continue growing with Powerhouse Tech
            </p>
            <p className="mt-1 text-sm text-text-secondary">
              Schedule a strategy call to discuss expanding your automation →
            </p>
          </div>
          <Button asChild size="lg" className="shrink-0">
            <a href={bookingUrl} target="_blank" rel="noopener noreferrer">
              Book a Call
              <ArrowRight className="h-4 w-4" />
            </a>
          </Button>
        </CardContent>
      </Card>
    </SectionReveal>
  );
}
