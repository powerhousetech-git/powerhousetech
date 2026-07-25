"use client";

import {
  Bar,
  CartesianGrid,
  Legend,
  BarChart as RechartsBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CHART_COLORS, formatPct } from "@/lib/utils";
import type { AppointmentData } from "@/types/dashboard";

const ANIMATION = 800;

export interface ReminderEffectivenessChartProps {
  data: AppointmentData["reminderEffectiveness"];
  title?: string;
}

export function ReminderEffectivenessChart({
  data,
  title = "Reminder effectiveness",
}: ReminderEffectivenessChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    shortLabel: d.touchpoint.replace(" (before)", "").replace("No automation", "Before"),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <RechartsBarChart
            data={chartData}
            margin={{ top: 8, right: 8, left: 0, bottom: 48 }}
          >
            <CartesianGrid stroke="#2A2A3A" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="shortLabel"
              tick={{ fill: "#55556A", fontSize: 10 }}
              axisLine={{ stroke: "#2A2A3A" }}
              tickLine={false}
              interval={0}
              angle={-12}
              textAnchor="end"
              height={56}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: "#55556A", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              cursor={{ fill: "rgba(66, 79, 209, 0.06)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as (typeof data)[0];
                return (
                  <div className="rounded-xl border border-border bg-surface px-3 py-2 text-xs">
                    <p className="mb-1 max-w-[200px] font-medium text-text-primary">
                      {row.touchpoint}
                    </p>
                    <p style={{ color: CHART_COLORS[0] }}>
                      Confirmation: {formatPct(row.confirmationRate, 0)}
                    </p>
                    <p style={{ color: CHART_COLORS[1] }}>
                      Show rate: {formatPct(row.showRate, 0)}
                    </p>
                  </div>
                );
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 12, color: "#9999AA" }}
              formatter={(value) => (
                <span className="text-text-secondary">{value}</span>
              )}
            />
            <Bar
              dataKey="confirmationRate"
              name="Confirmation rate"
              fill={CHART_COLORS[0]}
              radius={[4, 4, 0, 0]}
              animationDuration={ANIMATION}
            />
            <Bar
              dataKey="showRate"
              name="Show rate"
              fill={CHART_COLORS[1]}
              radius={[4, 4, 0, 0]}
              animationDuration={ANIMATION}
            />
          </RechartsBarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
