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

function formatHour(hour: number) {
  if (hour === 0) return "12a";
  if (hour < 12) return `${hour}a`;
  if (hour === 12) return "12p";
  return `${hour - 12}p`;
}

export interface LeadsByHourChartProps {
  data: LeadPipelineData["leadsByHour"];
  afterHoursLeadShare?: number;
  title?: string;
}

export function LeadsByHourChart({
  data,
  afterHoursLeadShare,
  title = "Leads by hour",
}: LeadsByHourChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    label: formatHour(d.hour),
  }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{title}</CardTitle>
        {afterHoursLeadShare !== undefined && (
          <p className="text-xs text-text-muted">
            After hours:{" "}
            <span className="font-semibold text-primary-light">
              {afterHoursLeadShare}%
            </span>
          </p>
        )}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <XAxis
              dataKey="label"
              tick={{ fill: "#55556A", fontSize: 9 }}
              interval={2}
              axisLine={{ stroke: "#2A2A3A" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#55556A", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: "rgba(66, 79, 209, 0.06)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null;
                const row = payload[0].payload as (typeof chartData)[0];
                return (
                  <div className="rounded-xl border border-border bg-surface px-3 py-2 text-xs">
                    <p className="font-medium text-text-primary">
                      {row.label}
                      {row.isAfterHours && (
                        <span className="ml-1 text-accent-amber">(after hours)</span>
                      )}
                    </p>
                    <p className="text-text-secondary">
                      {formatNumber(row.count)} leads
                    </p>
                  </div>
                );
              }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} animationDuration={ANIMATION}>
              {chartData.map((entry) => (
                <Cell
                  key={entry.hour}
                  fill={entry.isAfterHours ? CHART_COLORS[2] : CHART_COLORS[0]}
                  fillOpacity={entry.isAfterHours ? 1 : 0.65}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
