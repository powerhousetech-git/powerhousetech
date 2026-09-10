"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Trophy } from "lucide-react";
import type { FollowUp } from "@/lib/types";
import { cn } from "@/lib/utils";

const COLORS = { done: "#16A34A", pending: "#D97706", overdue: "#DC2626" };

export function FollowUpPerformance({ followUps }: { followUps: FollowUp[] }) {
  const counts = {
    done: followUps.filter((f) => f.status === "done").length,
    pending: followUps.filter((f) => f.status === "pending").length,
    overdue: followUps.filter((f) => f.status === "overdue").length,
  };
  const pieData = [
    { name: "Done", key: "done", value: counts.done },
    { name: "Pending", key: "pending", value: counts.pending },
    { name: "Overdue", key: "overdue", value: counts.overdue },
  ].filter((d) => d.value > 0);

  const board = leaderboard(followUps);

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-bold text-ink-900">Status breakdown</p>
        {pieData.length === 0 ? (
          <p className="text-sm text-ink-500">कोई data नहीं।</p>
        ) : (
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={38}
                  outerRadius={64}
                  paddingAngle={2}
                >
                  {pieData.map((d) => (
                    <Cell key={d.key} fill={COLORS[d.key as keyof typeof COLORS]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="flex justify-center gap-3 text-xs">
          <Legend color={COLORS.done} label={`Done ${counts.done}`} />
          <Legend color={COLORS.pending} label={`Pending ${counts.pending}`} />
          <Legend color={COLORS.overdue} label={`Overdue ${counts.overdue}`} />
        </div>
      </div>

      <div>
        <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-ink-900">
          <Trophy className="h-4 w-4 text-amber-500" /> Leaderboard
        </p>
        {board.length === 0 ? (
          <p className="text-sm text-ink-500">अभी कोई assignment नहीं।</p>
        ) : (
          <ol className="space-y-1.5">
            {board.map((row, idx) => (
              <li
                key={row.name}
                className="flex items-center justify-between rounded-lg bg-sand-50 px-3 py-1.5 text-sm"
              >
                <span className="flex items-center gap-2 font-semibold text-ink-800">
                  <span className="text-ink-400">{idx + 1}.</span>
                  {row.name}
                </span>
                <span
                  className={cn(
                    "font-extrabold",
                    row.rate >= 90 ? "text-success" : row.rate >= 70 ? "text-warn" : "text-danger",
                  )}
                >
                  {row.rate}%
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1 text-ink-600">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function leaderboard(followUps: FollowUp[]) {
  const byName: Record<string, { total: number; done: number }> = {};
  for (const f of followUps) {
    const name = f.assigned_to?.trim();
    if (!name) continue;
    byName[name] ||= { total: 0, done: 0 };
    byName[name].total += 1;
    if (f.status === "done") byName[name].done += 1;
  }
  return Object.entries(byName)
    .map(([name, v]) => ({ name, rate: Math.round((v.done / v.total) * 100) }))
    .sort((a, b) => b.rate - a.rate);
}
