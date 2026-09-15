"use client";

import { useMemo, useState } from "react";
import { useApi } from "@/components/useApi";
import type { Message, MessageStatus } from "@/lib/types";
import { MESSAGE_STAGES } from "@/lib/constants";
import { formatDate, formatDateTime, parseFlexibleDate, waLink } from "@/lib/utils";
import { DataTable, type Column } from "@/components/DataTable";
import { MessageStatusBadge } from "@/components/StatusBadge";
import { KPICard } from "@/components/KPICard";

const inputCls =
  "rounded-xl border border-slate-200 bg-surface-light px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-white/10 dark:bg-surface-dark";

export default function PostSalePage() {
  const { data, loading } = useApi<{ messages: Message[] }>("/api/messages");
  const messages = useMemo(() => data?.messages ?? [], [data]);

  const [status, setStatus] = useState<MessageStatus | "all">("all");
  const [type, setType] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(() => {
    const fromD = parseFlexibleDate(from);
    const toD = parseFlexibleDate(to);
    if (toD) toD.setHours(23, 59, 59, 999);
    return messages.filter((m) => {
      if (status !== "all" && m.status !== status) return false;
      if (type !== "all" && m.message_type.toLowerCase() !== type) return false;
      const when = parseFlexibleDate(m.scheduled_date);
      if (fromD && when && when < fromD) return false;
      if (toD && when && when > toD) return false;
      return true;
    });
  }, [messages, status, type, from, to]);

  const stats = useMemo(() => {
    const total = messages.length;
    const sent = messages.filter((m) => m.status === "sent").length;
    const pending = messages.filter((m) => m.status === "pending").length;
    const failed = messages.filter((m) => m.status === "failed").length;
    const rate = sent + failed > 0 ? Math.round((sent / (sent + failed)) * 100) : 0;
    return { total, sent, pending, failed, rate };
  }, [messages]);

  const columns: Column<Message>[] = [
    { key: "customer_name", header: "Customer", sortable: true, render: (m) => <span className="font-semibold">{m.customer_name}</span> },
    {
      key: "customer_phone",
      header: "Phone",
      render: (m) =>
        m.customer_phone ? (
          <a href={waLink(m.customer_phone)} target="_blank" rel="noreferrer" className="text-teal-600 hover:underline dark:text-teal-400">
            {m.customer_phone}
          </a>
        ) : ("—"),
    },
    { key: "product", header: "Product" },
    { key: "message_type", header: "Type", sortable: true, render: (m) => <span className="capitalize">{m.message_type.replace(/_/g, " ")}</span> },
    { key: "scheduled_date", header: "Scheduled", sortable: true, sortValue: (m) => m.scheduled_date, render: (m) => formatDate(m.scheduled_date) },
    { key: "status", header: "Status", sortable: true, render: (m) => <MessageStatusBadge status={m.status} /> },
    { key: "sent_at", header: "Sent At", render: (m) => (m.sent_at ? formatDateTime(m.sent_at) : "—") },
  ];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Post-Sale Messages</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Scheduled WhatsApp automation</p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KPICard label="Total" value={stats.total} tone="brand" />
        <KPICard label="Sent" value={stats.sent} tone="teal" />
        <KPICard label="Pending" value={stats.pending} tone="amber" />
        <KPICard label="Failed" value={stats.failed} tone="red" />
        <KPICard label="Success Rate" value={`${stats.rate}%`} tone="emerald" />
      </div>

      <div className="flex flex-wrap gap-2">
        <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as MessageStatus | "all")}>
          <option value="all">All status</option>
          <option value="pending">Pending</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
        </select>
        <select className={inputCls} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="all">All types</option>
          {MESSAGE_STAGES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        <input type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" />
        <input type="date" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} aria-label="To" />
        <span className="ml-auto self-center text-xs text-slate-400">{filtered.length} messages</span>
      </div>

      {loading ? (
        <div className="h-64 animate-pulse rounded-2xl bg-slate-100 dark:bg-white/5" />
      ) : (
        <DataTable columns={columns} rows={filtered} empty="No messages match these filters." />
      )}
    </div>
  );
}
