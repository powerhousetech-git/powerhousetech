"use client";

import {
  Clock,
  MessageSquare,
  Send,
  TriangleAlert,
  Users,
} from "lucide-react";
import { useApi } from "@/components/useApi";
import type { DashboardData } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";
import { KPICard, KPICardSkeleton } from "@/components/KPICard";
import { MessagesPerDayChart, FollowUpPieChart, FunnelChart } from "@/components/Charts";
import { MessageStatusBadge } from "@/components/StatusBadge";

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-surface-light p-4 shadow-card dark:border-white/10 dark:bg-surface-dark">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function DashboardPage() {
  const { data, loading, error } = useApi<DashboardData>("/api/dashboard");
  const k = data?.kpis;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Dashboard</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Post-sale automation &amp; follow-up overview
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {loading || !k ? (
          Array.from({ length: 5 }).map((_, i) => <KPICardSkeleton key={i} />)
        ) : (
          <>
            <KPICard label="Total Clients" value={k.totalClients} tone="brand" icon={<Users className="h-4 w-4" />} />
            <KPICard label="Sent Today" value={k.messagesSentToday} tone="teal" icon={<Send className="h-4 w-4" />} />
            <KPICard label="Pending Msgs" value={k.pendingMessages} tone="amber" icon={<Clock className="h-4 w-4" />} />
            <KPICard label="Overdue FU" value={k.overdueFollowUps} tone="red" icon={<TriangleAlert className="h-4 w-4" />} />
            <KPICard label="Employees" value={k.activeEmployees} tone="emerald" icon={<MessageSquare className="h-4 w-4" />} />
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel title="Messages Sent — last 30 days">
            {loading || !data ? (
              <div className="h-64 animate-pulse rounded-xl bg-slate-100 dark:bg-white/5" />
            ) : (
              <MessagesPerDayChart data={data.messagesPerDay} />
            )}
          </Panel>
        </div>
        <Panel title="Follow-Up Status">
          {loading || !data ? (
            <div className="h-64 animate-pulse rounded-xl bg-slate-100 dark:bg-white/5" />
          ) : (
            <FollowUpPieChart data={data.followUpBreakdown} />
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Post-Sale Funnel">
          {loading || !data ? (
            <div className="h-40 animate-pulse rounded-xl bg-slate-100 dark:bg-white/5" />
          ) : (
            <FunnelChart data={data.funnel} />
          )}
        </Panel>

        <Panel title="Recent Activity">
          {loading || !data ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-9 animate-pulse rounded-lg bg-slate-100 dark:bg-white/5" />
              ))}
            </div>
          ) : data.recentActivity.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No messages sent yet.</p>
          ) : (
            <ul className="max-h-72 space-y-1.5 overflow-y-auto">
              {data.recentActivity.map((m, i) => (
                <li key={i} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-white/5">
                  <span className="min-w-0 truncate">
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{m.customer_name}</span>
                    <span className="ml-2 text-xs text-slate-400">{m.message_type}</span>
                  </span>
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    <MessageStatusBadge status={m.status} />
                    <span className="text-xs text-slate-400">{formatDateTime(m.sent_at)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {error ? (
        <p className="rounded-xl bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-500/15 dark:text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
