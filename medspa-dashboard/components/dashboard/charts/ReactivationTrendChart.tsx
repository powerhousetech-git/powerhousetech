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
import { CHART_COLORS, formatCurrency, formatNumber } from "@/lib/utils";
import type { ReactivationData } from "@/types/dashboard";

const ANIMATION = 800;

export interface ReactivationTrendChartProps {
  data: ReactivationData["monthlyReactivation"];
  title?: string;
}

export function ReactivationTrendChart({
  data,
  title = "Reactivation performance",
}: ReactivationTrendChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="reactBooked" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS[0]} stopOpacity={0.35} />
                <stop offset="100%" stopColor={CHART_COLORS[0]} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="reactRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS[1]} stopOpacity={0.25} />
                <stop offset="100%" stopColor={CHART_COLORS[1]} stopOpacity={0} />
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
              yAxisId="left"
              tick={{ fill: "#55556A", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
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
                    <p className="text-text-secondary">
                      Sent: {formatNumber(row.sent)}
                    </p>
                    <p style={{ color: CHART_COLORS[0] }}>
                      Booked: {formatNumber(row.booked)}
                    </p>
                    <p style={{ color: CHART_COLORS[1] }}>
                      Revenue: {formatCurrency(row.revenue)}
                    </p>
                  </div>
                );
              }}
            />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="booked"
              name="Booked"
              stroke={CHART_COLORS[0]}
              fill="url(#reactBooked)"
              strokeWidth={2}
              animationDuration={ANIMATION}
            />
            <Area
              yAxisId="right"
              type="monotone"
              dataKey="revenue"
              name="Revenue"
              stroke={CHART_COLORS[1]}
              fill="url(#reactRevenue)"
              strokeWidth={2}
              animationDuration={ANIMATION}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
