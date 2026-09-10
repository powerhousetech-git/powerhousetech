import "server-only";
import type {
  Employee,
  FollowUp,
  Kpis,
  Message,
  Sale,
  ScorecardRow,
  StatsPayload,
  TrendPoint,
  YesterdaySummary,
} from "./types";
import { getEmployees, getFollowUps, getMessages, getSales } from "./data";
import { getN8nStats } from "./n8n";
import { isDemoMode } from "./sheets";
import { daysBetween, overdueDays, parseDate, startOfDay } from "./utils";

function sameDay(dateStr: string, ref: Date): boolean {
  const d = parseDate(dateStr);
  if (!d) return false;
  return daysBetween(d, ref) === 0;
}

const DELIVERED = new Set(["delivered", "read"]);

function computeKpis(messages: Message[], followUps: FollowUp[]): Kpis {
  const today = startOfDay(new Date());

  const sentToday = messages.filter(
    (m) => m.sent_at && sameDay(m.sent_at, today) && m.status !== "pending",
  ).length;

  const last7Sent = messages.filter((m) => {
    const d = parseDate(m.sent_at);
    if (!d || m.status === "pending") return false;
    const diff = daysBetween(today, d);
    return diff >= 0 && diff <= 6;
  });
  const deliveredLast7 = last7Sent.filter((m) => DELIVERED.has(m.status)).length;
  const deliveryRate =
    last7Sent.length === 0
      ? 0
      : Math.round((deliveredLast7 / last7Sent.length) * 100);

  const pendingFollowUps = followUps.filter(
    (f) => f.status === "pending" && overdueDays(f.due_date) >= 0,
  ).length;
  const overdueItems = followUps.filter((f) => f.status === "overdue").length;

  return {
    sentToday,
    deliveryRate,
    deliveredLast7,
    sentLast7: last7Sent.length,
    pendingFollowUps,
    overdueItems,
  };
}

function computeYesterday(
  messages: Message[],
  followUps: FollowUp[],
  sales: Sale[],
): YesterdaySummary {
  const yesterday = startOfDay(new Date());
  yesterday.setDate(yesterday.getDate() - 1);

  const sentMsgs = messages.filter(
    (m) => m.sent_at && sameDay(m.sent_at, yesterday) && m.status !== "pending",
  );
  const delivered = sentMsgs.filter((m) => DELIVERED.has(m.status)).length;
  const failed = sentMsgs.filter((m) => m.status === "failed").length;

  const dueYesterday = followUps.filter((f) => sameDay(f.due_date, yesterday));
  const completed = followUps.filter(
    (f) => f.done_at && sameDay(f.done_at, yesterday),
  ).length;

  const newSalesRows = sales.filter((s) => sameDay(s.date, yesterday));
  const newSalesAmount = newSalesRows.reduce(
    (sum, s) => sum + (Number(s.amount) || 0),
    0,
  );

  return {
    messagesSent: sentMsgs.length,
    delivered,
    failed,
    followUpsCompleted: completed,
    followUpsAssigned: dueYesterday.length,
    newSales: newSalesRows.length,
    newSalesAmount,
  };
}

function computeScorecard(
  followUps: FollowUp[],
  employees: Employee[],
): ScorecardRow[] {
  const names = new Set<string>();
  employees
    .filter((e) => e.active && e.role !== "Admin")
    .forEach((e) => names.add(e.name));
  followUps.forEach((f) => {
    if (f.assigned_to) names.add(f.assigned_to);
  });

  const rows: ScorecardRow[] = [];
  for (const name of names) {
    const mine = followUps.filter((f) => f.assigned_to === name);
    if (mine.length === 0) continue;
    const completed = mine.filter((f) => f.status === "done").length;
    const overdue = mine.filter((f) => f.status === "overdue").length;
    const score = mine.length === 0 ? 0 : Math.round((completed / mine.length) * 100);
    rows.push({ employee: name, assigned: mine.length, completed, overdue, score });
  }
  return rows.sort((a, b) => b.score - a.score || b.assigned - a.assigned);
}

function computeTrend(messages: Message[], followUps: FollowUp[]): TrendPoint[] {
  const today = startOfDay(new Date());
  const points: TrendPoint[] = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date(today);
    day.setDate(day.getDate() - i);
    const label = day.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "2-digit",
    });
    const sent = messages.filter(
      (m) => m.sent_at && sameDay(m.sent_at, day) && m.status !== "pending",
    ).length;
    const completed = followUps.filter(
      (f) => f.done_at && sameDay(f.done_at, day),
    ).length;
    points.push({ date: label, sent, completed });
  }
  return points;
}

export async function computeStats(): Promise<StatsPayload> {
  const [messages, followUps, sales, employees] = await Promise.all([
    getMessages(),
    getFollowUps(),
    getSales(),
    getEmployees(),
  ]);

  const n8nStats = await getN8nStats();

  return {
    kpis: computeKpis(messages, followUps),
    yesterday: computeYesterday(messages, followUps, sales),
    scorecard: computeScorecard(followUps, employees),
    trend: computeTrend(messages, followUps),
    demoMode: isDemoMode(),
    n8nStats,
  };
}
