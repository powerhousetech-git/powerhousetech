"use client";

import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CHART_COLORS, formatNumber, formatPct } from "@/lib/utils";
import type { LeadPipelineData } from "@/types/dashboard";

const ANIMATION = 800;

export interface FunnelChartProps {
  data: LeadPipelineData["funnel"];
  title?: string;
}

export function FunnelChart({
  data,
  title = "Lead conversion funnel",
}: FunnelChartProps) {
  const chartData = [...data].reverse();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 4, right: 48, left: 8, bottom: 4 }}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="stage"
              width={120}
              tick={{ fill: "#55556A", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: "rgba(66, 79, 209, 0.08)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null;
                const row = payload[0].payload as (typeof data)[0];
                return (
                  <div className="rounded-xl border border-border bg-surface px-3 py-2 text-xs shadow-card">
                    <p className="font-semibold text-text-primary">{row.stage}</p>
                    <p className="text-text-secondary">
                      {formatNumber(row.count)} ({formatPct(row.percentage, 0)})
                    </p>
                    {row.dropOffPct > 0 && (
                      <p className="text-accent-amber">
                        Drop-off: {formatPct(row.dropOffPct, 0)}
                      </p>
                    )}
                  </div>
                );
              }}
            />
            <Bar
              dataKey="count"
              radius={[0, 6, 6, 0]}
              animationDuration={ANIMATION}
            >
              {chartData.map((_, i) => (
                <Cell
                  key={i}
                  fill={CHART_COLORS[i % CHART_COLORS.length]}
                  fillOpacity={0.85 - i * 0.08}
                />
              ))}
              <LabelList
                dataKey="count"
                position="right"
                formatter={(v) => formatNumber(Number(v))}
                className="fill-text-secondary text-xs"
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-text-muted">
          {data
            .filter((s) => s.dropOffPct > 0)
            .map((s) => (
              <span key={s.stage}>
                {s.stage}:{" "}
                <span className="text-accent-amber">
                  −{formatPct(s.dropOffPct, 0)} drop-off
                </span>
              </span>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}
