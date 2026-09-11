"use client";

import { useMemo, useState } from "react";
import { useApi } from "@/components/useApi";
import type { Client, FollowUpBucket } from "@/lib/types";
import { formatDate, formatINR, parseFlexibleDate, waLink } from "@/lib/utils";
import { DataTable, type Column } from "@/components/DataTable";
import { FollowUpBadge } from "@/components/StatusBadge";

type Row = Client & { _bucket: FollowUpBucket };

const inputCls =
  "rounded-xl border border-slate-200 bg-surface-light px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-white/10 dark:bg-surface-dark";

const rowTint: Record<FollowUpBucket, string> = {
  overdue: "bg-red-50/70 dark:bg-red-500/5",
  due_today: "bg-amber-50/70 dark:bg-amber-500/5",
  upcoming: "",
  none: "",
};

export default function FollowUpsPage() {
  const { data, loading } = useApi<{ clients: Row[] }>("/api/follow-ups");
  const clients = useMemo(() => data?.clients ?? [], [data]);

  const [employee, setEmployee] = useState("all");
  const [bucket, setBucket] = useState<FollowUpBucket | "all">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const employees = useMemo(
    () => Array.from(new Set(clients.map((c) => c.assigned_employee).filter(Boolean))),
    [clients],
  );
  const overdueCount = clients.filter((c) => c._bucket === "overdue").length;

  const filtered = useMemo(() => {
    const fromD = parseFlexibleDate(from);
    const toD = parseFlexibleDate(to);
    if (toD) toD.setHours(23, 59, 59, 999);
    return clients.filter((c) => {
      if (employee !== "all" && c.assigned_employee !== employee) return false;
      if (bucket !== "all" && c._bucket !== bucket) return false;
      const when = parseFlexibleDate(c.next_follow_up_date);
      if (fromD && when && when < fromD) return false;
      if (toD && when && when > toD) return false;
      return true;
    });
  }, [clients, employee, bucket, from, to]);

  const columns: Column<Row>[] = [
    { key: "customer_name", header: "Customer", sortable: true, render: (c) => <span className="font-semibold">{c.customer_name || "—"}</span> },
    {
      key: "customer_phone",
      header: "Phone",
      render: (c) =>
        c.customer_phone ? (
          <a href={waLink(c.customer_phone)} target="_blank" rel="noreferrer" className="text-teal-600 hover:underline dark:text-teal-400">
            {c.customer_phone}
          </a>
        ) : ("—"),
    },
    { key: "assigned_employee", header: "Employee", sortable: true },
    { key: "product_category", header: "Product" },
    { key: "next_follow_up_date", header: "Follow-Up", sortable: true, sortValue: (c) => c.next_follow_up_date, render: (c) => formatDate(c.next_follow_up_date) },
    { key: "_bucket", header: "Status", sortable: true, render: (c) => <FollowUpBadge value={c._bucket} /> },
    { key: "sale_amount", header: "Amount", sortValue: (c) => Number(c.sale_amount) || 0, render: (c) => (c.sale_amount ? formatINR(c.sale_amount) : "—") },
    { key: "notes", header: "Notes", className: "max-w-[16rem]", render: (c) => <span className="text-slate-500 dark:text-slate-400">{c.notes || "—"}</span> },
  ];

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Follow-Up Tracker</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Client follow-ups (AI-mapped from your sheet)</p>
        </div>
        {overdueCount > 0 ? (
          <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-bold text-red-700 dark:bg-red-500/15 dark:text-red-300">
            {overdueCount} overdue
          </span>
        ) : null}
      </header>

      <div className="flex flex-wrap gap-2">
        <select className={inputCls} value={employee} onChange={(e) => setEmployee(e.target.value)}>
          <option value="all">All employees</option>
          {employees.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        <select className={inputCls} value={bucket} onChange={(e) => setBucket(e.target.value as FollowUpBucket | "all")}>
          <option value="all">All status</option>
          <option value="overdue">Overdue</option>
          <option value="due_today">Due Today</option>
          <option value="upcoming">Upcoming</option>
        </select>
        <input type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" />
        <input type="date" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} aria-label="To" />
        <span className="ml-auto self-center text-xs text-slate-400">{filtered.length} clients</span>
      </div>

      {loading ? (
        <div className="h-64 animate-pulse rounded-2xl bg-slate-100 dark:bg-white/5" />
      ) : (
        <DataTable columns={columns} rows={filtered} rowClassName={(c) => rowTint[c._bucket]} empty="No clients match these filters." />
      )}
    </div>
  );
}
