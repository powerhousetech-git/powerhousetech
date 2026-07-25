"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber, formatPct } from "@/lib/utils";
import type { LeadPipelineData } from "@/types/dashboard";

const ANIMATION = 800;

export interface LeadSourcePieChartProps {
  data: LeadPipelineData["leadsBySource"];
  title?: string;
}

export function LeadSourcePieChart({
  data,
  title = "Leads by source",
}: LeadSourcePieChartProps) {
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="count"
                nameKey="source"
                cx="50%"
                cy="50%"
                innerRadius="58%"
                outerRadius="82%"
                paddingAngle={2}
                animationDuration={ANIMATION}
              >
                {data.map((entry) => (
                  <Cell key={entry.source} fill={entry.color} stroke="transparent" />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const row = payload[0].payload as (typeof data)[0];
                  return (
                    <div className="rounded-xl border border-border bg-surface px-3 py-2 text-xs">
                      <p className="font-medium text-text-primary">{row.source}</p>
                      <p className="text-text-secondary">
                        {formatNumber(row.count)} ({formatPct(row.percentage, 0)})
                      </p>
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-3xl font-bold text-text-primary">
              {formatNumber(total)}
            </p>
            <p className="text-xs text-text-muted">Total leads</p>
          </div>
        </div>
        <ul className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
          {data.map((d) => (
            <li key={d.source} className="flex items-center gap-2 text-text-secondary">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: d.color }}
              />
              <span className="truncate">{d.source}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
