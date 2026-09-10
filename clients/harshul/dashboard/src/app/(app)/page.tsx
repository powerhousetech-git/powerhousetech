"use client";

import { useMemo } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  MessageCircle,
  Send,
  TriangleAlert,
} from "lucide-react";
import { apiSend, useApi } from "@/lib/client";
import type { FollowUp, StatsPayload } from "@/lib/types";
import { formatINR, overdueDays } from "@/lib/utils";
import { KpiCard, KpiCardSkeleton, type KpiTone } from "@/components/KpiCard";
import { ActionList } from "@/components/ActionList";
import { EmployeeScorecard } from "@/components/EmployeeScorecard";
import { TrendChart } from "@/components/TrendChart";
import { Card, SectionTitle, Skeleton } from "@/components/primitives";

function deliveryTone(rate: number): KpiTone {
  if (rate >= 90) return "green";
  if (rate >= 70) return "yellow";
  return "red";
}

export default function HomePage() {
  const stats = useApi<StatsPayload>("/api/stats");
  const followups = useApi<{ followUps: FollowUp[] }>("/api/followups");

  const todaysActions = useMemo(() => {
    const rows = followups.data?.followUps ?? [];
    return rows
      .filter(
        (f) =>
          (f.status === "pending" || f.status === "overdue") &&
          overdueDays(f.due_date) >= 0,
      )
      .sort((a, b) => overdueDays(b.due_date) - overdueDays(a.due_date));
  }, [followups.data]);

  async function markDone(ticketId: string, doneBy: string) {
    await apiSend("/api/mark-done", "POST", { ticket_id: ticketId, done_by: doneBy });
    await Promise.all([stats.refetch(), followups.refetch()]);
  }

  const k = stats.data?.kpis;
  const y = stats.data?.yesterday;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-ink-900">Daily Digest</h1>
        <p className="text-sm text-ink-500">
          आज का रिपोर्ट · {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      {/* Section A: KPI cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.loading || !k ? (
          <>
            <KpiCardSkeleton />
            <KpiCardSkeleton />
            <KpiCardSkeleton />
            <KpiCardSkeleton />
          </>
        ) : (
          <>
            <KpiCard
              label="Sent Today"
              hindi="आज भेजे"
              value={k.sentToday}
              tone={k.sentToday > 0 ? "green" : "neutral"}
              icon={<Send className="h-4 w-4" />}
            />
            <KpiCard
              label="Delivery Rate"
              hindi="डिलीवरी (7 दिन)"
              value={`${k.deliveryRate}%`}
              sub={`${k.deliveredLast7}/${k.sentLast7} delivered`}
              tone={deliveryTone(k.deliveryRate)}
              icon={<CheckCircle2 className="h-4 w-4" />}
            />
            <KpiCard
              label="Pending Follow-Ups"
              hindi="बाकी काम"
              value={k.pendingFollowUps}
              tone={k.pendingFollowUps > 10 ? "red" : k.pendingFollowUps > 5 ? "yellow" : "neutral"}
              icon={<Clock className="h-4 w-4" />}
            />
            <KpiCard
              label="Overdue Items"
              hindi="देरी से"
              value={k.overdueItems}
              tone={k.overdueItems > 0 ? "red" : "green"}
              icon={<TriangleAlert className="h-4 w-4" />}
            />
          </>
        )}
      </div>

      {/* Section B: Today's action list */}
      <Card className="p-4">
        <SectionTitle title="Today's Action List" hindi="आज के काम" />
        {followups.loading ? (
          <div className="space-y-2">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : (
          <ActionList items={todaysActions} onMarkDone={markDone} />
        )}
      </Card>

      {/* Section C: Yesterday's summary */}
      <Card className="p-4">
        <SectionTitle title="Yesterday's Summary" hindi="कल का हिसाब" />
        {stats.loading || !y ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <SummaryStat
                icon={<MessageCircle className="h-4 w-4" />}
                label="Messages sent"
                value={`${y.messagesSent}`}
                sub={`${y.delivered} delivered · ${y.failed} failed`}
              />
              <SummaryStat
                icon={<CheckCircle2 className="h-4 w-4" />}
                label="Follow-ups done"
                value={`${y.followUpsCompleted}/${y.followUpsAssigned}`}
              />
              <SummaryStat
                icon={<CalendarClock className="h-4 w-4" />}
                label="New sales"
                value={`${y.newSales}`}
              />
              <SummaryStat
                icon={<Send className="h-4 w-4" />}
                label="Sales value"
                value={formatINR(y.newSalesAmount)}
              />
            </div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-500">
              Employee scorecard · कर्मचारी स्कोर
            </p>
            <EmployeeScorecard rows={stats.data?.scorecard ?? []} />
          </>
        )}
      </Card>

      {/* Section D: This week's trend */}
      <Card className="p-4">
        <SectionTitle title="This Week's Trend" hindi="इस हफ्ते का रुझान" />
        {stats.loading || !stats.data ? (
          <Skeleton className="h-56" />
        ) : (
          <TrendChart data={stats.data.trend} />
        )}
      </Card>

      {stats.error ? (
        <p className="rounded-xl bg-danger-bg px-3 py-2 text-sm text-danger">
          {stats.error}
        </p>
      ) : null}
    </div>
  );
}

function SummaryStat({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-sand-50 p-3">
      <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-ink-500">
        <span className="text-clay-500">{icon}</span>
        {label}
      </div>
      <p className="text-xl font-extrabold text-ink-900">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-ink-500">{sub}</p> : null}
    </div>
  );
}
