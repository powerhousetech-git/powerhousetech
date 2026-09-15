export const DEFAULT_SHEET_ID = "1BbtJp8j0HxFVxvEdyakjk8P4FMUL3l-FyJrgR2IO6mY";

export function sheetId(): string {
  return process.env.SHEET_ID || DEFAULT_SHEET_ID;
}

// Post-sale message stages, in funnel order, with their Day-X offsets.
export const MESSAGE_STAGES: { key: string; label: string; day: number }[] = [
  { key: "thank_you", label: "Thank You", day: 0 },
  { key: "care_check", label: "Care Check", day: 3 },
  { key: "feedback", label: "Feedback", day: 7 },
  { key: "upsell", label: "Upsell", day: 14 },
  { key: "referral", label: "Referral", day: 30 },
];

export const N8N_WORKFLOWS: { name: string; id: string }[] = [
  { name: "HRS_AI_SCHEMA_MAP", id: "ZsjLCCHaWqOh2E3b" },
  { name: "HRS_FU_01_AI_FollowUp_Checker", id: "WS7GrXKMvXc2Yc02" },
  { name: "HRS_PS_01_AI_New_Sale_Ingest", id: "yelMG1v3Zeyo8d6l" },
  { name: "HRS_PS_02_AI_Message_Sender", id: "2mvaNo35PfcJkVkD" },
  { name: "HRS_DD_01_AI_Daily_Digest", id: "t4e47zsQINAxpFrk" },
];

export function n8nBaseUrl(): string {
  return (process.env.N8N_BASE_URL || "https://shreyas-sinha.app.n8n.cloud").replace(/\/$/, "");
}

export function workflowLinks() {
  const base = n8nBaseUrl();
  return N8N_WORKFLOWS.map((w) => ({ ...w, url: `${base}/workflow/${w.id}` }));
}
