export type UserRole = "sahasra_admin" | "sahasra_employee" | "pt_admin";

export type LeadStatus =
  | "new"
  | "mail_1_sent"
  | "follow_up_1"
  | "follow_up_2"
  | "follow_up_3"
  | "follow_up_4"
  | "follow_up_5"
  | "follow_up_6"
  | "follow_up_7"
  | "follow_up_8"
  | "follow_up_9"
  | "follow_up_10"
  | "responded"
  | "meeting_scheduled"
  | "converted"
  | "discarded";

export type LeadSource = "business_card" | "excel" | "google_sheet" | "manual";

export type ProjectStage =
  | "enquiry_received"
  | "bid_submitted"
  | "order_won"
  | "production"
  | "quality_check"
  | "delivery"
  | "completed"
  | "on_hold";

export type EmailDirection = "outbound" | "inbound";
export type EmailSentiment = "positive" | "neutral" | "negative";
export type EmailStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "sent"
  | "rejected";

export interface User {
  id: string;
  organization_id: string;
  username: string;
  password_hash?: string;
  full_name: string;
  role: UserRole;
  outlook_account: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  organization_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  company: string;
  designation: string;
  email: string;
  phone: string;
  website: string;
  website_summary: string | null;
  status: LeadStatus;
  source: LeadSource;
  assigned_to: string | null;
  tags: string[];
  custom_intro: string | null;
  notes: string | null;
  meeting_scheduled_at: string | null;
  upload_batch_id: string | null;
  last_activity_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadEmail {
  id: string;
  lead_id: string;
  direction: EmailDirection;
  subject: string;
  body: string;
  sentiment: EmailSentiment | null;
  sequence_step: number | null;
  status: EmailStatus;
  is_ai_draft: boolean;
  sent_at: string | null;
  received_at: string | null;
  created_at: string;
  created_by: string | null;
}

export interface MailSequenceStep {
  id: string;
  organization_id: string;
  step_number: number;
  label: string;
  day_offset: number;
  subject_template: string;
  body_template: string;
  is_active: boolean;
  updated_at: string;
}

export interface ClientProject {
  id: string;
  organization_id: string;
  lead_id: string | null;
  client_name: string;
  project_name: string;
  order_value: number;
  stage: ProjectStage;
  assigned_to: string | null;
  target_date: string | null;
  notes: string | null;
  quotation_ref: string | null;
  documents: unknown[];
  stage_entered_at: string;
  created_at: string;
  updated_at: string;
}

export interface StageTransition {
  id: string;
  project_id: string;
  from_stage: ProjectStage | null;
  to_stage: ProjectStage;
  notes: string | null;
  documents: unknown[];
  transitioned_by: string | null;
  created_at: string;
}

export interface SystemSetting {
  id: string;
  organization_id: string;
  key: string;
  value: unknown;
  updated_at: string;
}

export interface ActivityLog {
  id: string;
  organization_id: string;
  actor_id: string | null;
  entity_type: string;
  entity_id: string;
  action: string;
  summary: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface GoogleSheetConnection {
  id: string;
  organization_id: string;
  sheet_url: string;
  sheet_id: string;
  tab_name: string;
  column_mapping: Record<string, string>;
  sync_interval_hours: number;
  last_synced_at: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface UploadBatch {
  id: string;
  organization_id: string;
  source_type: string;
  filename: string;
  storage_path: string | null;
  total_records: number;
  imported_count: number;
  duplicate_count: number;
  failed_count: number;
  uploaded_by: string | null;
  created_at: string;
}

export interface OutlookAccount {
  id: string;
  email: string;
  display_name: string;
  is_connected: boolean;
  user_id: string | null;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface DashboardStats {
  total_leads: number;
  new_leads: number;
  sent_leads: number;
  responded_leads: number;
  meetings_scheduled: number;
  converted_leads: number;
  discarded_leads: number;
  funnel: { status: string; count: number; label: string }[];
}

export interface LeadFilters {
  status?: LeadStatus | LeadStatus[];
  source?: LeadSource;
  assigned_to?: string;
  search?: string;
  tags?: string[];
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
