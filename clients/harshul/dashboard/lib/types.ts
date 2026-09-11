// Standard (normalized) keys the dashboard understands. The AI_Config tab maps
// these to whatever the actual Sheet1 column headers are (Hindi/English/mixed).
export const STANDARD_KEYS = [
  "customer_name",
  "customer_phone",
  "next_follow_up_date",
  "assigned_employee",
  "product_category",
  "status",
  "sale_amount",
  "notes",
  "sale_date",
] as const;

export type StandardKey = (typeof STANDARD_KEYS)[number];

export type AIMapping = Partial<Record<StandardKey, string>>;

export type Client = Record<StandardKey, string>;

export type MessageStatus = "pending" | "sent" | "failed";

export interface Message {
  sale_id: string;
  customer_name: string;
  customer_phone: string;
  product: string;
  message_type: string;
  scheduled_date: string;
  status: MessageStatus;
  sent_at: string;
  created_at: string;
}

export interface Employee {
  name: string;
  phone: string;
  role: string;
}

export type FollowUpBucket = "overdue" | "due_today" | "upcoming" | "none";

export interface EmployeeScore {
  name: string;
  phone: string;
  role: string;
  assigned: number;
  overdue: number;
  dueToday: number;
  upcoming: number;
  completionRate: number; // on-track % = (assigned - overdue) / assigned
  clients: Client[];
}

export interface DashboardData {
  kpis: {
    totalClients: number;
    messagesSentToday: number;
    pendingMessages: number;
    overdueFollowUps: number;
    activeEmployees: number;
  };
  messagesPerDay: { date: string; count: number }[];
  followUpBreakdown: { overdue: number; dueToday: number; upcoming: number };
  funnel: { stage: string; label: string; count: number }[];
  recentActivity: Message[];
  demoMode: boolean;
}

export interface HealthStatus {
  evolution: { configured: boolean; ok: boolean; state: string; error?: string };
  n8n: { baseUrl: string; workflows: { name: string; id: string; url: string }[] };
  sheets: { demoMode: boolean; sheetId: string };
}
