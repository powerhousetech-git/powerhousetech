"use client";

import { useState } from "react";
import { AlertTriangle, Check, Square, User } from "lucide-react";
import type { FollowUp } from "@/lib/types";
import { cn, overdueDays } from "@/lib/utils";
import { Spinner } from "@/components/primitives";

function groupByEmployee(items: FollowUp[]): Record<string, FollowUp[]> {
  const groups: Record<string, FollowUp[]> = {};
  for (const f of items) {
    const key = f.assigned_to?.trim() || "Unassigned";
    (groups[key] ||= []).push(f);
  }
  return groups;
}

function dueLabel(f: FollowUp): { text: string; overdue: boolean } {
  const d = overdueDays(f.due_date);
  if (d > 0) return { text: `OVERDUE (${d} day${d > 1 ? "s" : ""})`, overdue: true };
  return { text: "due today", overdue: false };
}

export function ActionList({
  items,
  onMarkDone,
}: {
  items: FollowUp[];
  onMarkDone: (ticketId: string, doneBy: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const groups = groupByEmployee(items);
  const names = Object.keys(groups).sort((a, b) =>
    a === "Unassigned" ? 1 : b === "Unassigned" ? -1 : a.localeCompare(b),
  );

  async function handle(f: FollowUp) {
    setBusy(f.ticket_id);
    try {
      await onMarkDone(f.ticket_id, f.assigned_to || "dashboard");
    } finally {
      setBusy(null);
    }
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl bg-success-bg/60 px-4 py-6 text-center text-sm font-semibold text-success">
        सब हो गया! 🎉 आज कोई काम बाकी नहीं है।
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {names.map((name) => (
        <div key={name}>
          <div className="mb-1.5 flex items-center gap-1.5 text-sm font-bold text-ink-700">
            <User className="h-4 w-4 text-clay-500" />
            {name}
            <span className="rounded-full bg-sand-100 px-1.5 text-xs font-semibold text-ink-500">
              {groups[name].length}
            </span>
          </div>
          <ul className="space-y-1.5">
            {groups[name].map((f) => {
              const label = dueLabel(f);
              const isBusy = busy === f.ticket_id;
              return (
                <li
                  key={f.ticket_id}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border px-3 py-2.5",
                    label.overdue
                      ? "border-danger/30 bg-danger-bg/40"
                      : "border-line bg-white",
                  )}
                >
                  {label.overdue ? (
                    <AlertTriangle className="h-5 w-5 shrink-0 text-danger" />
                  ) : (
                    <Square className="h-5 w-5 shrink-0 text-ink-400" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink-900">
                      {f.task}
                      {f.customer_name ? (
                        <span className="font-normal text-ink-500">
                          {" "}
                          — {f.customer_name}
                        </span>
                      ) : null}
                    </p>
                    <p
                      className={cn(
                        "text-xs font-semibold",
                        label.overdue ? "text-danger" : "text-warn",
                      )}
                    >
                      {label.text}
                    </p>
                  </div>
                  <button
                    onClick={() => handle(f)}
                    disabled={isBusy}
                    className="inline-flex items-center gap-1 rounded-lg bg-success px-2.5 py-1.5 text-xs font-bold text-white transition hover:brightness-95 disabled:opacity-50"
                  >
                    {isBusy ? <Spinner className="h-3 w-3" /> : <Check className="h-4 w-4" />}
                    <span className="hidden sm:inline">Mark Done</span>
                    <span className="opacity-80">पूरा</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
