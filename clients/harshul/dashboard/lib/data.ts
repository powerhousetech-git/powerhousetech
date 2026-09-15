import "server-only";
import { getAIMapping, getSheetData, isDemoMode } from "./sheets";
import { applyMapping } from "./mapping";
import { MESSAGE_STAGES } from "./constants";
import {
  followUpBucket,
  istDateKey,
  istTodayKey,
  lastNDateKeys,
} from "./utils";
import type {
  Client,
  DashboardData,
  Employee,
  EmployeeScore,
  Message,
  MessageStatus,
} from "./types";

function pick(row: Record<string, string>, names: string[]): string {
  for (const n of names) {
    if (row[n] !== undefined && row[n] !== "") return row[n];
    // case-insensitive fallback
    const key = Object.keys(row).find((k) => k.toLowerCase() === n.toLowerCase());
    if (key && row[key]) return row[key];
  }
  return "";
}

function normStatus(v: string): MessageStatus {
  const s = (v || "").toLowerCase().trim();
  if (s === "sent") return "sent";
  if (s === "failed") return "failed";
  return "pending";
}

export async function getClients(): Promise<Client[]> {
  const [rows, mapping] = await Promise.all([getSheetData("Sheet1"), getAIMapping()]);
  return applyMapping(rows, mapping);
}

export async function getMessages(): Promise<Message[]> {
  const rows = await getSheetData("Messages");
  return rows.map((r) => ({
    sale_id: pick(r, ["sale_id"]),
    customer_name: pick(r, ["customer_name"]),
    customer_phone: pick(r, ["customer_phone"]),
    product: pick(r, ["product"]),
    message_type: pick(r, ["message_type"]),
    scheduled_date: pick(r, ["scheduled_date"]),
    status: normStatus(pick(r, ["status"])),
    sent_at: pick(r, ["sent_at"]),
    created_at: pick(r, ["created_at"]),
  }));
}

export async function getEmployees(): Promise<Employee[]> {
  const rows = await getSheetData("Employees");
  return rows
    .map((r) => ({
      name: pick(r, ["Name", "name"]),
      phone: pick(r, ["Phone", "phone"]),
      role: pick(r, ["Role", "role"]),
    }))
    .filter((e) => e.name);
}

export async function getEmployeeScores(): Promise<EmployeeScore[]> {
  const [clients, employees] = await Promise.all([getClients(), getEmployees()]);
  return employees.map((e) => {
    const mine = clients.filter(
      (c) => c.assigned_employee.trim().toLowerCase() === e.name.trim().toLowerCase(),
    );
    const overdue = mine.filter((c) => followUpBucket(c.next_follow_up_date) === "overdue").length;
    const dueToday = mine.filter((c) => followUpBucket(c.next_follow_up_date) === "due_today").length;
    const upcoming = mine.filter((c) => followUpBucket(c.next_follow_up_date) === "upcoming").length;
    const completionRate = mine.length ? Math.round(((mine.length - overdue) / mine.length) * 100) : 0;
    return {
      name: e.name,
      phone: e.phone,
      role: e.role,
      assigned: mine.length,
      overdue,
      dueToday,
      upcoming,
      completionRate,
      clients: mine,
    };
  });
}

export async function getDashboard(): Promise<DashboardData> {
  const [clients, messages, employees] = await Promise.all([
    getClients(),
    getMessages(),
    getEmployees(),
  ]);

  const today = istTodayKey();
  const sent = messages.filter((m) => m.status === "sent");

  const messagesSentToday = sent.filter((m) => istDateKey(m.sent_at) === today).length;
  const pendingMessages = messages.filter((m) => m.status === "pending").length;

  const buckets = clients.reduce(
    (acc, c) => {
      const b = followUpBucket(c.next_follow_up_date);
      if (b === "overdue") acc.overdue += 1;
      else if (b === "due_today") acc.dueToday += 1;
      else if (b === "upcoming") acc.upcoming += 1;
      return acc;
    },
    { overdue: 0, dueToday: 0, upcoming: 0 },
  );

  const keys = lastNDateKeys(30);
  const perDayMap = new Map(keys.map((k) => [k, 0]));
  for (const m of sent) {
    const k = istDateKey(m.sent_at);
    if (perDayMap.has(k)) perDayMap.set(k, (perDayMap.get(k) || 0) + 1);
  }
  const messagesPerDay = keys.map((k) => ({
    date: k.slice(5), // MM-DD
    count: perDayMap.get(k) || 0,
  }));

  const funnel = MESSAGE_STAGES.map((s) => ({
    stage: s.key,
    label: s.label,
    count: sent.filter((m) => m.message_type.toLowerCase() === s.key).length,
  }));

  const recentActivity = sent
    .slice()
    .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())
    .slice(0, 20);

  return {
    kpis: {
      totalClients: clients.length,
      messagesSentToday,
      pendingMessages,
      overdueFollowUps: buckets.overdue,
      activeEmployees: employees.length,
    },
    messagesPerDay,
    followUpBreakdown: buckets,
    funnel,
    recentActivity,
    demoMode: isDemoMode(),
  };
}
