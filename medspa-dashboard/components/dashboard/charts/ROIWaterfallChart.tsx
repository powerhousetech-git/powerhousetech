"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CHART_COLORS, formatCurrency } from "@/lib/utils";
import type { RevenueImpactData } from "@/types/dashboard";

const ANIMATION = 800;

export interface ROIWaterfallChartProps {
  data: RevenueImpactData["monthlyBreakdown"];
  title?: string;
}

export function ROIWaterfallChart({
  data,
  title = "Cumulative ROI by channel",
}: ROIWaterfallChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="roiNoShow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS[0]} stopOpacity={0.5} />
                <stop offset="100%" stopColor={CHART_COLORS[0]} stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="roiReactivation" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS[1]} stopOpacity={0.45} />
                <stop offset="100%" stopColor={CHART_COLORS[1]} stopOpacity={0.08} />
              </linearGradient>
              <linearGradient id="roiAfterHours" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS[2]} stopOpacity={0.4} />
                <stop offset="100%" stopColor={CHART_COLORS[2]} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#2A2A3A" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fill: "#55556A", fontSize: 11 }}
              axisLine={{ stroke: "#2A2A3A" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#55556A", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as (typeof data)[0];
                return (
                  <div className="rounded-xl border border-border bg-surface px-3 py-2 text-xs">
                    <p className="mb-1 font-medium text-text-primary">{label}</p>
                    <p style={{ color: CHART_COLORS[0] }}>
                      No-show recovery: {formatCurrency(row.noShow)}
                    </p>
                    <p style={{ color: CHART_COLORS[1] }}>
                      Reactivation: {formatCurrency(row.reactivation)}
                    </p>
                    <p style={{ color: CHART_COLORS[2] }}>
                      After-hours: {formatCurrency(row.afterHours)}
                    </p>
                    <p className="mt-1 border-t border-border pt-1 font-semibold text-text-primary">
                      Cumulative: {formatCurrency(row.cumulative)}
                    </p>
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="afterHours"
              name="After-hours"
              stackId="1"
              stroke={CHART_COLORS[2]}
              fill="url(#roiAfterHours)"
              animationDuration={ANIMATION}
            />
            <Area
              type="monotone"
              dataKey="reactivation"
              name="Reactivation"
              stackId="1"
              stroke={CHART_COLORS[1]}
              fill="url(#roiReactivation)"
              animationDuration={ANIMATION}
            />
            <Area
              type="monotone"
              dataKey="noShow"
              name="No-show recovery"
              stackId="1"
              stroke={CHART_COLORS[0]}
              fill="url(#roiNoShow)"
              animationDuration={ANIMATION}
            />
          </AreaChart>
        </ResponsiveContainer>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#424FD1]" />
            No-show recovery
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-accent-green" />
            Reactivation
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-accent-amber" />
            After-hours
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
