// Shared domain types for the outreach analytics dashboard.

/** The two outreach campaigns tracked in the sheet. */
export type Campaign = 'India' | 'US';

/** Campaign selection in the UI (a real campaign or the merged view). */
export type CampaignSelection = Campaign | 'Both';

/**
 * Lead lifecycle status, exactly as stored in the sheet's `Status` column.
 * Extra/unknown values are tolerated at parse time and typed as `string`.
 */
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
  /** Which campaign this lead belongs to (added during parsing). */
  campaign: Campaign;
}

/** Email type as recorded in the "Email Log" tab. */
export type EmailType = 'Initial' | 'Follow-up 1' | 'Follow-up 2';

/** Delivery status recorded in the "Email Log" tab. */
export type EmailSendStatus = 'Sent' | 'Failed';

/** A single row from the "Email Log" tab. */
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

/** Full parsed dataset returned by the data hook. */
export interface SheetData {
  indiaLeads: Lead[];
  usLeads: Lead[];
  emailLog: LogEntry[];
}
