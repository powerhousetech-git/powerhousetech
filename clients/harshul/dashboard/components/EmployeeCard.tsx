"use client";

import { useState } from "react";
import { ChevronDown, Phone, UserRound } from "lucide-react";
import type { EmployeeScore } from "@/lib/types";
import { cn, followUpBucket, formatDate } from "@/lib/utils";
import { FollowUpBadge } from "@/components/StatusBadge";

export function EmployeeCard({ emp }: { emp: EmployeeScore }) {
  const [open, setOpen] = useState(false);
  const rateColor =
    emp.completionRate >= 90 ? "text-emerald-600" : emp.completionRate >= 70 ? "text-amber-600" : "text-red-600";

  return (
    <div className="rounded-2xl border border-slate-200 bg-surface-light p-4 shadow-card dark:border-white/10 dark:bg-surface-dark">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-600 text-white">
            <UserRound className="h-5 w-5" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-white">{emp.name}</p>
            <p className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              <Phone className="h-3 w-3" /> {emp.phone || "—"} · {emp.role || "—"}
            </p>
          </div>
        </div>
        {emp.overdue > 0 ? (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700 dark:bg-red-500/15 dark:text-red-300">
            {emp.overdue} overdue
          </span>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2 text-center">
        <Stat label="Assigned" value={emp.assigned} />
        <Stat label="Overdue" value={emp.overdue} tone={emp.overdue > 0 ? "red" : undefined} />
        <Stat label="Due Today" value={emp.dueToday} tone={emp.dueToday > 0 ? "amber" : undefined} />
        <div>
          <p className={cn("text-lg font-extrabold", rateColor)}>{emp.completionRate}%</p>
          <p className="text-[10px] uppercase tracking-wide text-slate-400">On-track</p>
        </div>
      </div>

      <button
        onClick={() => setOpen((o) => !o)}
        disabled={emp.clients.length === 0}
        className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg border border-slate-200 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
      >
        {open ? "Hide" : "View"} clients ({emp.clients.length})
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <ul className="mt-2 divide-y divide-slate-100 dark:divide-white/5">
          {emp.clients.map((c, i) => (
            <li key={i} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span className="min-w-0 truncate">
                <span className="font-semibold text-slate-800 dark:text-slate-100">{c.customer_name}</span>
                <span className="ml-2 text-xs text-slate-400">{formatDate(c.next_follow_up_date)}</span>
              </span>
              <FollowUpBadge value={followUpBucket(c.next_follow_up_date)} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "red" | "amber" }) {
  const color = tone === "red" ? "text-red-600" : tone === "amber" ? "text-amber-600" : "text-slate-900 dark:text-white";
  return (
    <div>
      <p className={cn("text-lg font-extrabold", color)}>{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
    </div>
  );
}
