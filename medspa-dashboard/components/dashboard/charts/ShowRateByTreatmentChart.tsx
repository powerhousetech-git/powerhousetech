"use client";

import {
  Bar,
  BarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CHART_COLORS, formatNumber, formatPct } from "@/lib/utils";
import type { AppointmentData } from "@/types/dashboard";

const ANIMATION = 800;
const INDUSTRY_SHOW_RATE = 83;

export interface ShowRateByTreatmentChartProps {
  data: AppointmentData["showRateByTreatment"];
  industryRef?: number;
  title?: string;
}

export function ShowRateByTreatmentChart({
  data,
  industryRef = INDUSTRY_SHOW_RATE,
  title = "Show rate by treatment",
}: ShowRateByTreatmentChartProps) {
  const chartData = [...data].sort((a, b) => a.showRate - b.showRate);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
          >
            <XAxis
              type="number"
              domain={[70, 100]}
              tick={{ fill: "#55556A", fontSize: 11 }}
              tickFormatter={(v) => `${v}%`}
              axisLine={{ stroke: "#2A2A3A" }}
            />
            <YAxis
              type="category"
              dataKey="treatment"
              width={100}
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
                    <p className="font-medium text-text-primary">{row.treatment}</p>
                    <p className="text-text-secondary">
                      Show rate: {formatPct(row.showRate, 0)}
                    </p>
                    <p className="text-text-muted">
                      {formatNumber(row.appointmentCount)} appointments
                    </p>
                  </div>
                );
              }}
            />
            <ReferenceLine
              x={industryRef}
              stroke={CHART_COLORS[2]}
              strokeDasharray="5 5"
              label={{
                value: `${industryRef}% industry`,
                position: "insideTopRight",
                fill: CHART_COLORS[2],
                fontSize: 10,
              }}
            />
            <Bar
              dataKey="showRate"
              fill={CHART_COLORS[1]}
              radius={[0, 6, 6, 0]}
              animationDuration={ANIMATION}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
