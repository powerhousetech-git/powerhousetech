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
import type { ReviewData } from "@/types/dashboard";

const ANIMATION = 800;

export interface ReviewGenerationChartProps {
  data: ReviewData["monthlyReviews"];
  title?: string;
}

export function ReviewGenerationChart({
  data,
  title = "Review generation",
}: ReviewGenerationChartProps) {
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
              yAxisId="count"
              tick={{ fill: "#55556A", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="rating"
              orientation="right"
              domain={[4, 5]}
              tick={{ fill: "#55556A", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickCount={5}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as (typeof data)[0];
                return (
                  <div className="rounded-xl border border-border bg-surface px-3 py-2 text-xs">
                    <p className="mb-1 font-medium text-text-primary">{label}</p>
                    <p className="text-text-secondary">
                      Requested: {formatNumber(row.requested)}
                    </p>
                    <p style={{ color: CHART_COLORS[1] }}>
                      Received: {formatNumber(row.received)}
                    </p>
                    <p style={{ color: CHART_COLORS[2] }}>
                      Avg rating: {row.avgRating.toFixed(1)}
                    </p>
                  </div>
                );
              }}
            />
            <Bar
              yAxisId="count"
              dataKey="requested"
              name="Requested"
              fill={CHART_COLORS[0]}
              fillOpacity={0.45}
              radius={[4, 4, 0, 0]}
              animationDuration={ANIMATION}
            />
            <Bar
              yAxisId="count"
              dataKey="received"
              name="Received"
              fill={CHART_COLORS[1]}
              radius={[4, 4, 0, 0]}
              animationDuration={ANIMATION}
            />
            <Line
              yAxisId="rating"
              type="monotone"
              dataKey="avgRating"
              name="Avg rating"
              stroke={CHART_COLORS[2]}
              strokeWidth={2}
              dot={{ r: 3 }}
              animationDuration={ANIMATION}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
