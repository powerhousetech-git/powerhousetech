import type { LeadStatus, ProjectStage, UserRole } from "./types";

export const COOKIE_NAME = "ps2_token";

export const ORG_ID = "b1c2d3e4-f5a6-7890-abcd-ef1234567890";
export const ADMIN_ID = "c2d3e4f5-a6b7-8901-bcde-f12345678901";
export const PT_ADMIN_ID = "d3e4f5a6-b7c8-9012-cdef-123456789012";
export const EMPLOYEE_ID = "e4f5a6b7-c8d9-0123-def0-234567890123";

export const LEAD_STATUSES: Record<LeadStatus, string> = {
  new: "New",
  mail_1_sent: "Mail 1 Sent",
  follow_up_1: "Follow Up 1",
  follow_up_2: "Follow Up 2",
  follow_up_3: "Follow Up 3",
  follow_up_4: "Follow Up 4",
  follow_up_5: "Follow Up 5",
  follow_up_6: "Follow Up 6",
  follow_up_7: "Follow Up 7",
  follow_up_8: "Follow Up 8",
  follow_up_9: "Follow Up 9",
  follow_up_10: "Follow Up 10",
  responded: "Responded",
  meeting_scheduled: "Meeting Scheduled",
  converted: "Converted",
  discarded: "Discarded",
};

export const PROJECT_STAGES: Record<ProjectStage, string> = {
  enquiry_received: "Enquiry Received",
  bid_submitted: "Bid Submitted",
  order_won: "Order Won",
  production: "Production",
  quality_check: "Quality Check",
  delivery: "Delivery",
  completed: "Completed",
  on_hold: "On Hold",
};

export const ROLE_PERMISSIONS: Record<
  UserRole,
  { label: string; routes: string[] }
> = {
  sahasra_admin: {
    label: "Sahasra Admin",
    routes: ["*"],
  },
  sahasra_employee: {
    label: "Sahasra Employee",
    routes: [
      "/",
      "/leads",
      "/pipeline",
      "/review-drafts",
      "/tracker",
      "/settings/outlook",
    ],
  },
  pt_admin: {
    label: "PT Admin",
    routes: ["/settings/system"],
  },
};

export const STATUS_BADGE_CLASSES: Record<string, string> = {
  new: "bg-gray-100 text-gray-700 border-gray-200",
  mail_1_sent: "bg-blue-100 text-blue-700 border-blue-200",
  follow_up_1: "bg-blue-100 text-blue-700 border-blue-200",
  follow_up_2: "bg-blue-100 text-blue-700 border-blue-200",
  follow_up_3: "bg-blue-100 text-blue-700 border-blue-200",
  follow_up_4: "bg-blue-100 text-blue-700 border-blue-200",
  follow_up_5: "bg-blue-100 text-blue-700 border-blue-200",
  follow_up_6: "bg-blue-100 text-blue-700 border-blue-200",
  follow_up_7: "bg-blue-100 text-blue-700 border-blue-200",
  follow_up_8: "bg-blue-100 text-blue-700 border-blue-200",
  follow_up_9: "bg-blue-100 text-blue-700 border-blue-200",
  follow_up_10: "bg-blue-100 text-blue-700 border-blue-200",
  responded: "bg-green-100 text-green-700 border-green-200",
  meeting_scheduled: "bg-purple-100 text-purple-700 border-purple-200",
  converted: "bg-emerald-100 text-emerald-700 border-emerald-200",
  discarded: "bg-red-100 text-red-700 border-red-200",
};

export const SENTIMENT_BADGE_CLASSES: Record<string, string> = {
  positive: "bg-green-100 text-green-700 border-green-200",
  neutral: "bg-amber-100 text-amber-700 border-amber-200",
  negative: "bg-red-100 text-red-700 border-red-200",
};

export const LEAD_SOURCES: Record<string, string> = {
  business_card: "Business Card",
  excel: "Excel",
  google_sheet: "Google Sheet",
  manual: "Manual",
};

export const PROJECT_STAGE_ORDER: ProjectStage[] = [
  "enquiry_received",
  "bid_submitted",
  "order_won",
  "production",
  "quality_check",
  "delivery",
  "completed",
  "on_hold",
];
