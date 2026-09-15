"use client";

import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardData } from "@/lib/types";

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid rgba(148,163,184,0.3)",
  fontSize: 12,
  background: "rgba(17,26,46,0.95)",
  color: "#fff",
};

export function MessagesPerDayChart({ data }: { data: DashboardData["messagesPerDay"] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} interval={4} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(13,148,136,0.08)" }} />
          <Bar dataKey="count" name="Sent" fill="#0d9488" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const PIE_COLORS = { overdue: "#dc2626", dueToday: "#d97706", upcoming: "#059669" };

export function FollowUpPieChart({ data }: { data: DashboardData["followUpBreakdown"] }) {
  const pieData = [
    { name: "Overdue", key: "overdue", value: data.overdue },
    { name: "Due Today", key: "dueToday", value: data.dueToday },
    { name: "Upcoming", key: "upcoming", value: data.upcoming },
  ].filter((d) => d.value > 0);

  if (pieData.length === 0) {
    return <p className="py-16 text-center text-sm text-slate-400">No follow-ups yet.</p>;
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
            {pieData.map((d) => (
              <Cell key={d.key} fill={PIE_COLORS[d.key as keyof typeof PIE_COLORS]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function FunnelChart({ data }: { data: DashboardData["funnel"] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="space-y-2">
      {data.map((d, i) => {
        const pct = Math.round((d.count / max) * 100);
        const shade = 600 - i * 80;
        return (
          <div key={d.stage} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-xs font-semibold text-slate-500 dark:text-slate-400">
              {d.label}
            </span>
            <div className="h-7 flex-1 overflow-hidden rounded-md bg-slate-100 dark:bg-white/5">
              <div
                className="flex h-full items-center justify-end rounded-md px-2 text-xs font-bold text-white transition-all"
                style={{ width: `${Math.max(pct, 8)}%`, background: `rgb(13 ${148 - i * 10} ${136 - i * 6})`, opacity: shade / 600 }}
              >
                {d.count}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
