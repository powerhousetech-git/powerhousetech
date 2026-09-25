// Shared domain types for the Outreach Command Center.

export type Campaign = 'India' | 'US';
export type CampaignSelection = Campaign | 'Both';

export type LeadStatus =
  | 'New'
  | 'Sent'
  | 'FU1_Sent'
  | 'FU2_Sent'
  | 'Replied'
  | 'Interested'
  | 'Not Interested'
  | 'Unsubscribe';

/** A single lead row from either the "India Leads" or "US Leads" tab. */
export interface Lead {
  Company_Name: string;
  Industry: string;
  City: string;
  Contact_Name: string;
  Email: string;
  Title: string;
  Status: string;
  Sent_Date: string;
  FU1_Date: string;
  FU2_Date: string;
  Apollo_Person_ID: string;
  Notes: string;
  /** Present only on US Leads rows. */
  State?: string;
  /** Campaign this lead belongs to (added during parsing). */
  campaign: Campaign;
  /** 1-based sheet row number (header = 1, first data row = 2). Used for writes. */
  _rowIndex: number;
}

export type EmailType = 'Initial' | 'Follow-up 1' | 'Follow-up 2';
export type EmailSendStatus = 'Sent' | 'Failed';

export interface LogEntry {
  Timestamp: string;
  Campaign: string;
  Company_Name: string;
  Contact_Name: string;
  Email: string;
  Email_Type: string;
  Subject: string;
  Status: string;
}

export interface SheetData {
  indiaLeads: Lead[];
  usLeads: Lead[];
  emailLog: LogEntry[];
}

/** Fields a user fills in the Add Lead form. */
export interface NewLeadInput {
  campaign: Campaign;
  Company_Name: string;
  Industry: string;
  City: string;
  Contact_Name: string;
  Email: string;
  Title: string;
  Status: string;
  Notes: string;
}

// --- n8n ---------------------------------------------------------------------

export type ExecutionStatus =
  | 'running'
  | 'success'
  | 'error'
  | 'waiting'
  | 'canceled'
  | 'unknown';

export interface WorkflowStatus {
  id: string;
  name: string;
  active: boolean;
  updatedAt?: string;
}

export interface Execution {
  id: string;
  workflowId?: string;
  status: ExecutionStatus;
  startedAt?: string;
  stoppedAt?: string;
  mode?: string;
  /** Present on single-execution fetches. */
  data?: unknown;
}

/** Which campaign a workflow drives. */
export interface WorkflowMeta {
  campaign: Campaign;
  id: string;
}
