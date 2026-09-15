/**
 * Harshul Tiles & Fittings — Dashboard config.
 *
 * Self-contained static app (deployed like the Sahasra costing portal).
 * All actions POST to n8n webhooks; the client table / replies are read
 * directly from the Google Sheet via the public gviz endpoint.
 *
 * Isolation: this app is 100% separate from Sahasra (Quotation) and
 * PS2 (Lead Management). It shares no code, storage keys, or endpoints.
 */
window.HRS = {
  // ── n8n webhooks ────────────────────────────────────────────
  // Workflows are INACTIVE during dev → use /webhook-test. Flip USE_TEST
  // to false (or toggle in Settings) once the workflows are activated.
  N8N_HOST: 'https://shreyas-sinha.app.n8n.cloud',
  USE_TEST: true,
  get N8N_BASE() {
    return this.N8N_HOST + (this.USE_TEST ? '/webhook-test' : '/webhook');
  },
  // Optional header auth for the webhooks (leave empty if the n8n
  // webhooks are public). Sent as `x-api-key` when set.
  N8N_API_KEY: '',

  WEBHOOKS: {
    send_message: 'hrs-send-message',
    trigger_digest: 'hrs-trigger-digest',
    trigger_followup: 'hrs-trigger-followup',
    mark_done: 'hrs-mark-followup-done',
    whatsapp_incoming: 'hrs-whatsapp-incoming', // Meta callback (not called by the dashboard)
  },

  // ── Google Sheet (read-only, client-side via gviz) ──────────
  // The sheet must be shared "Anyone with the link → Viewer" for the
  // gviz read to work from the browser. No API key is embedded.
  SHEET_ID: '1BbtJp8j0HxFVxvEdyakjk8P4FMUL3l-FyJrgR2IO6mY',
  SHEET_URL: 'https://docs.google.com/spreadsheets/d/1BbtJp8j0HxFVxvEdyakjk8P4FMUL3l-FyJrgR2IO6mY/edit',
  TABS: {
    clients: 'Sheet1',
    config: 'AI_Config',
    employees: 'Employees',
    replies: 'Replies',
  },
  // Optional Google Sheets API v4 key (used instead of gviz when set).
  GOOGLE_API_KEY: '',

  // ── AI column mapping ───────────────────────────────────────
  // AI_Config is a two-column tab: standard_field | actual_column.
  // Standard fields the dashboard understands (used as fallbacks / for
  // the Settings display). Never hardcode Sheet1 headers elsewhere.
  STANDARD_FIELDS: [
    'phone', 'customer_name', 'status', 'follow_up_date',
    'assigned_to', 'notes', 'sale_date', 'product',
  ],

  // ── Workflow registry (Settings page) ───────────────────────
  N8N_WORKFLOWS: [
    { name: 'HRS_DASH_01_Send_Message', id: 'CUA1mV8lz6fqgxOw', kind: 'Dashboard', webhook: 'hrs-send-message' },
    { name: 'HRS_DASH_02_Trigger_Digest', id: 'XLukDT8CHLD4rUF2', kind: 'Dashboard', webhook: 'hrs-trigger-digest' },
    { name: 'HRS_DASH_03_Trigger_FollowUp', id: 'wxf3mGrduWcTeiEV', kind: 'Dashboard', webhook: 'hrs-trigger-followup' },
    { name: 'HRS_FU_02_Mark_Done', id: 'ri29hivwzbQ6KMhb', kind: 'Dashboard', webhook: 'hrs-mark-followup-done' },
    { name: 'HRS_PS_03_Reply_Handler', id: 'Q22fCRl6C0XkpWWz', kind: 'Meta callback', webhook: 'hrs-whatsapp-incoming' },
    { name: 'HRS_AI_SCHEMA_MAP', id: 'ZsjLCCHaWqOh2E3b', kind: 'Manual', webhook: '' },
    { name: 'HRS_PS_01_AI_New_Sale_Ingest', id: 'yelMG1v3Zeyo8d6l', kind: 'Trigger', webhook: '' },
    { name: 'HRS_PS_02_AI_Message_Sender', id: '2mvaNo35PfcJkVkD', kind: 'Schedule', webhook: '' },
    { name: 'HRS_DD_01_AI_Daily_Digest', id: 't4e47zsQINAxpFrk', kind: 'Schedule', webhook: '' },
    { name: 'HRS_FU_01_AI_FollowUp_Checker', id: 'WS7GrXKMvXc2Yc02', kind: 'Schedule', webhook: '' },
  ],
  workflowUrl: function (id) { return this.N8N_HOST + '/workflow/' + id; },

  // ── Light access gate ───────────────────────────────────────
  // Client-side passcode only (Phase 1). Upgrade to Firebase / Google
  // sign-in later. Kept in sessionStorage under an HRS-specific key.
  GATE_PASSCODE: 'harshul',
  GATE_KEY: 'hrs_gate_ok',

  // Testing number from the brief (owner/dev). Client number set later.
  TEST_PHONE: '919119188492',

  // Timezone for all date comparisons.
  TZ: 'Asia/Kolkata',
};
