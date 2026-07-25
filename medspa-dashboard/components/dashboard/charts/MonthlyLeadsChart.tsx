"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CHART_COLORS, formatNumber } from "@/lib/utils";
import type { LeadPipelineData } from "@/types/dashboard";

const ANIMATION = 800;

export interface MonthlyLeadsChartProps {
  data: LeadPipelineData["monthlyTrend"];
  title?: string;
}

export function MonthlyLeadsChart({
  data,
  title = "Monthly leads & bookings",
}: MonthlyLeadsChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as (typeof data)[0];
                return (
                  <div className="rounded-xl border border-border bg-surface px-3 py-2 text-xs">
                    <p className="mb-1 font-medium text-text-primary">{label}</p>
                    <p style={{ color: CHART_COLORS[0] }}>
                      Leads: {formatNumber(row.leads)}
                    </p>
                    <p style={{ color: CHART_COLORS[1] }}>
                      Booked: {formatNumber(row.booked)}
                    </p>
                  </div>
                );
              }}
            />
            <Bar
              dataKey="leads"
              name="Leads"
              fill={CHART_COLORS[0]}
              fillOpacity={0.55}
              radius={[4, 4, 0, 0]}
              animationDuration={ANIMATION}
            />
            <Line
              type="monotone"
              dataKey="booked"
              name="Booked"
              stroke={CHART_COLORS[1]}
              strokeWidth={2.5}
              dot={{ r: 4, fill: CHART_COLORS[1] }}
              animationDuration={ANIMATION}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
