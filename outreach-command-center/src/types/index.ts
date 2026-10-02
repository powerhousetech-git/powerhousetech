// Shared domain types for the Outreach Command Center (sheet schema v2).

export type Campaign = 'India' | 'US';
export type CampaignSelection = Campaign | 'Both';

/**
 * Lead lifecycle status as stored in the sheet `Status` column (v2).
 * Legacy v1 values are still parsed if present so old rows do not break the UI.
 */
export type LeadStatus =
  | 'Pending'
  | 'In_Sequence'
  | 'Completed'
  | 'Rejected'
  | 'Replied'
  | 'Interested'
  | 'Not Interested'
  | 'Unsubscribe'
  // Legacy v1
  | 'New'
  | 'Sent'
  | 'FU1_Sent'
  | 'FU2_Sent';

/** A single lead row from either the "India Leads" or "US Leads" tab. */
export interface Lead {
  Company_Name: string;
  Contact_Name: string;
  Title: string;
  Email: string;
  Industry: string;
  City: string;
  State: string;
  Country: string;
  Website: string;
  LinkedIn_URL: string;
  Apollo_ID: string;
  Added_Date: string;
  Status: string;
  Sequence_Step: string;
  Next_Send_Date: string;
  /** Optional / legacy columns — kept if present in the sheet. */
  Notes: string;
  Sent_Date: string;
  FU1_Date: string;
  FU2_Date: string;
  /** Alias of Apollo_ID for older analytics helpers. */
  Apollo_Person_ID: string;
  /** Campaign this lead belongs to (added during parsing). */
  campaign: Campaign;
  /** 1-based sheet row number (header = 1, first data row = 2). Used for writes. */
  _rowIndex: number;
}

export type EmailType = 'Initial' | 'Follow-up 1' | 'Follow-up 2' | string;
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

/** Settings tab key/value pairs that drive live n8n behavior. */
export interface OutreachSettings {
  India_Daily_Cap: number;
  US_Daily_Cap: number;
  FU_Interval_Days: number;
  Max_Sequence_Steps: number;
  /** 1-based sheet row for each key (for writes). */
  _rows: Partial<Record<keyof Omit<OutreachSettings, '_rows'>, number>>;
}

export interface SheetData {
  indiaLeads: Lead[];
  usLeads: Lead[];
  emailLog: LogEntry[];
  settings: OutreachSettings;
}

/** Fields a user fills in the Add Lead form. */
export interface NewLeadInput {
  campaign: Campaign;
  Company_Name: string;
  Industry: string;
  City: string;
  State: string;
  Country: string;
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

export interface ApolloDiscoveryInput {
  /** Required by Apollo Discovery webhook — which leads tab to write. */
  campaign: Campaign;
  per_page: number;
  titles?: string[];
  keywords?: string;
  /** Optional city/region override (e.g. "Mumbai"). Country defaults from campaign in n8n. */
  location?: string;
}
