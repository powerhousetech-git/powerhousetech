// Row shapes mirror the Google Sheets columns EXACTLY (n8n workflows depend on
// these names). Booleans are stored as "TRUE"/"FALSE" strings in Sheets and are
// parsed to real booleans at the edges (see sheets.ts).

export type MessageStatus =
  | "pending"
  | "sent"
  | "delivered"
  | "read"
  | "failed";

export type FollowUpStatus = "pending" | "done" | "overdue";

export type TemplateLanguage = "HI" | "EN" | "HI+EN";

export type EmployeeRole = "Salesman" | "Installer" | "Admin";

export interface Sale {
  sale_id: string;
  date: string;
  customer_name: string;
  phone: string;
  product_category: string;
  product_sku: string;
  quantity: string;
  amount: string;
  salesperson: string;
  msg_sequence_status: string;
}

export interface Message {
  msg_id: string;
  sale_id: string;
  phone: string;
  customer_name: string;
  template_id: string;
  message_body: string;
  media_url: string;
  send_at: string;
  status: MessageStatus;
  sent_at: string;
  delivered_at: string;
  read_at: string;
  error: string;
}

export interface FollowUp {
  ticket_id: string;
  sale_id: string;
  customer_name: string;
  phone: string;
  task: string;
  description: string;
  assigned_to: string;
  assigned_phone: string;
  due_date: string;
  status: FollowUpStatus;
  created_at: string;
  done_at: string;
  done_by: string;
  notes: string;
}

export interface Template {
  template_id: string;
  language: TemplateLanguage;
  body: string;
  media_url: string;
  delay_days: string;
  condition_field: string;
  condition_value: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UpsellRule {
  rule_id: string;
  product_category: string;
  upsell_product: string;
  message_hi: string;
  message_en: string;
  image_url: string;
  active: boolean;
}

export interface Employee {
  employee_id: string;
  name: string;
  phone: string;
  role: EmployeeRole;
  active: boolean;
}

export interface Settings {
  business_name: string;
  google_review_url: string;
  notify_9am: boolean;
  notify_1pm: boolean;
  notify_6pm: boolean;
}

// ── Derived / computed shapes (not stored in Sheets) ──────────────

export interface Kpis {
  sentToday: number;
  deliveryRate: number; // 0-100, over last 7 days
  deliveredLast7: number;
  sentLast7: number;
  pendingFollowUps: number; // pending, due <= today
  overdueItems: number; // pending, due < today
}

export interface ScorecardRow {
  employee: string;
  assigned: number;
  completed: number;
  overdue: number;
  score: number; // 0-100
}

export interface YesterdaySummary {
  messagesSent: number;
  delivered: number;
  failed: number;
  followUpsCompleted: number;
  followUpsAssigned: number;
  newSales: number;
  newSalesAmount: number;
}

export interface TrendPoint {
  date: string; // e.g. "Mon 08"
  sent: number;
  completed: number;
}

export interface StatsPayload {
  kpis: Kpis;
  yesterday: YesterdaySummary;
  scorecard: ScorecardRow[];
  trend: TrendPoint[];
  demoMode: boolean;
  n8nStats: N8nStats | null;
}

export interface N8nStats {
  sent_today?: number;
  delivered?: number;
  failed?: number;
  pending_followups?: number;
  overdue?: number;
}

export type SheetName =
  | "Sales"
  | "Messages"
  | "Follow_Ups"
  | "Templates"
  | "Upsell_Rules"
  | "Employees";
