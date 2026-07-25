"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CHART_COLORS, formatPct } from "@/lib/utils";
import type { AppointmentData } from "@/types/dashboard";

const ANIMATION = 800;

export interface NoShowTrendChartProps {
  data: AppointmentData["noShowTrend"];
  automationMonth?: string;
  title?: string;
}

export function NoShowTrendChart({
  data,
  automationMonth = "Apr",
  title = "No-show rate trend",
}: NoShowTrendChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
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
              domain={["auto", "auto"]}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="rounded-xl border border-border bg-surface px-3 py-2 text-xs">
                    <p className="mb-1 font-medium text-text-primary">{label}</p>
                    {payload.map((p, idx) => (
                      <p key={String(p.dataKey ?? idx)} style={{ color: p.color }}>
                        {p.name}: {formatPct(Number(p.value), 1)}
                      </p>
                    ))}
                  </div>
                );
              }}
            />
            <ReferenceLine
              x={automationMonth}
              stroke={CHART_COLORS[2]}
              strokeDasharray="4 4"
              label={{
                value: "Automation live",
                position: "top",
                fill: CHART_COLORS[2],
                fontSize: 10,
              }}
            />
            <Line
              type="monotone"
              dataKey="noShowRate"
              name="Your spa"
              stroke={CHART_COLORS[0]}
              strokeWidth={2.5}
              dot={{ r: 4, fill: CHART_COLORS[0] }}
              animationDuration={ANIMATION}
            />
            <Line
              type="monotone"
              dataKey="industry"
              name="Industry avg"
              stroke={CHART_COLORS[3]}
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              animationDuration={ANIMATION}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
