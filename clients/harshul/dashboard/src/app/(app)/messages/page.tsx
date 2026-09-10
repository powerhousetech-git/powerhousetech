"use client";

import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { useApi } from "@/lib/client";
import type { Message, MessageStatus } from "@/lib/types";
import { parseDate, toCsv } from "@/lib/utils";
import { MessageTable } from "@/components/MessageTable";
import { Button, inputClass, Skeleton } from "@/components/primitives";

const STATUSES: (MessageStatus | "all")[] = [
  "all", "pending", "sent", "delivered", "read", "failed",
];

export default function MessagesPage() {
  const { data, loading } = useApi<{ messages: Message[] }>("/api/messages");
  const messages = useMemo(() => data?.messages ?? [], [data]);

  const [status, setStatus] = useState<MessageStatus | "all">("all");
  const [template, setTemplate] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");

  const templates = useMemo(
    () => Array.from(new Set(messages.map((m) => m.template_id).filter(Boolean))),
    [messages],
  );

  const filtered = useMemo(() => {
    const fromD = parseDate(from);
    const toD = parseDate(to);
    if (toD) toD.setHours(23, 59, 59, 999);
    const needle = q.trim().toLowerCase();
    return messages.filter((m) => {
      if (status !== "all" && m.status !== status) return false;
      if (template !== "all" && m.template_id !== template) return false;
      const when = parseDate(m.sent_at || m.send_at);
      if (fromD && when && when < fromD) return false;
      if (toD && when && when > toD) return false;
      if (needle) {
        const hay = `${m.customer_name} ${m.phone} ${m.message_body}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [messages, status, template, from, to, q]);

  function exportCsv() {
    const csv = toCsv(
      filtered as unknown as Record<string, unknown>[],
      ["msg_id", "sale_id", "phone", "customer_name", "template_id", "message_body", "status", "sent_at", "delivered_at", "read_at", "error"],
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `messages-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-ink-900">Message Log</h1>
          <p className="text-sm text-ink-500">मैसेज · WhatsApp इतिहास</p>
        </div>
        <Button variant="secondary" onClick={exportCsv} disabled={filtered.length === 0}>
          <Download className="h-4 w-4" /> CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <div className="relative col-span-2 sm:col-span-3 lg:col-span-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-ink-400" />
          <input
            className={`${inputClass} pl-8`}
            placeholder="Search customer…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as MessageStatus | "all")}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === "all" ? "All status" : s}
            </option>
          ))}
        </select>
        <select className={inputClass} value={template} onChange={(e) => setTemplate(e.target.value)}>
          <option value="all">All templates</option>
          {templates.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input type="date" className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
        <input type="date" className={inputClass} value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
      </div>

      <p className="text-xs text-ink-500">{filtered.length} messages</p>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
      ) : (
        <MessageTable messages={filtered} />
      )}
    </div>
  );
}
