"use client";

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CHART_COLORS, formatNumber } from "@/lib/utils";
import type { LeadPipelineData } from "@/types/dashboard";

const ANIMATION = 800;

export interface ResponseTimeChartProps {
  data: LeadPipelineData["responseTimeDistribution"];
  contactedWithin60sPct?: number;
  title?: string;
}

export function ResponseTimeChart({
  data,
  contactedWithin60sPct = 96,
  title = "Response time distribution",
}: ResponseTimeChartProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <CardTitle>{title}</CardTitle>
        <div className="rounded-xl border border-accent-green/30 bg-accent-green/10 px-3 py-2 text-right">
          <p className="text-lg font-bold text-accent-green">
            {contactedWithin60sPct}%
          </p>
          <p className="text-[10px] uppercase tracking-wide text-text-muted">
            within 60s
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="bucket"
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
              cursor={{ fill: "rgba(66, 79, 209, 0.06)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null;
                const row = payload[0].payload as (typeof data)[0];
                return (
                  <div className="rounded-xl border border-border bg-surface px-3 py-2 text-xs">
                    <p className="font-medium text-text-primary">{row.bucket}</p>
                    <p className="text-text-secondary">
                      {formatNumber(row.count)} leads
                    </p>
                  </div>
                );
              }}
            />
            <Bar
              dataKey="count"
              radius={[6, 6, 0, 0]}
              animationDuration={ANIMATION}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.bucket}
                  fill={entry.isTarget ? CHART_COLORS[1] : CHART_COLORS[0]}
                  fillOpacity={entry.isTarget ? 1 : 0.55}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
