/**
 * Harshul Tiles & Fittings — dashboard config (v4).
 *
 * Read-only monitoring dashboard for two n8n automations (post-sale
 * messages + follow-up reminders). The dashboard does NOT send messages;
 * it monitors, and performs only 3 small writes via n8n webhooks:
 *   • Send All Reminders   (hrs-trigger-followup)
 *   • Mark Follow-Up Done  (hrs-mark-followup-done)
 *   • Update Upsell Pattern(hrs-update-upsell)
 *
 * Self-contained static app under /harshul. 100% isolated from
 * Sahasra (Quotation) and PS2 (Lead Management).
 */
window.HRS = {
  // ── n8n webhooks ────────────────────────────────────────────
  N8N_HOST: 'https://shreyas-sinha.app.n8n.cloud',
  USE_TEST: true, // dev: /webhook-test · prod: flip to false → /webhook
  get N8N_BASE() {
    return this.N8N_HOST + (this.USE_TEST ? '/webhook-test' : '/webhook');
  },
  N8N_API_KEY: '', // optional header auth; sent as x-api-key when set

  WEBHOOKS: {
    trigger_followup: 'hrs-trigger-followup',
    mark_done: 'hrs-mark-followup-done',
    update_upsell: 'hrs-update-upsell',
  },

  // ── Google Sheet (read-only via gviz JSONP) ─────────────────
  // Must be shared "Anyone with the link → Viewer" for browser reads.
  SHEET_ID: '1wD59Kx-0HXlEoXLWQrjJndDLkKVEjsic-adjBrjQdu4',
  SHEET_URL: 'https://docs.google.com/spreadsheets/d/1wD59Kx-0HXlEoXLWQrjJndDLkKVEjsic-adjBrjQdu4/edit',
  TABS: {
    config: 'AI_Config',   // standard_field → actual_column
    clients: 'Sheet1',     // client master (Hindi headers, AI-mapped)
    messages: 'Messages',  // post-sale message schedule (English headers)
    employees: 'Employees',
  },

  // AI_Config standard fields (never hardcode Sheet1 headers).
  STANDARD_FIELDS: [
    'phone', 'customer_name', 'status', 'follow_up_date',
    'assigned_to', 'notes', 'sale_date', 'product',
  ],

  // ── Post-sale message journey (5 steps over 30 days) ────────
  MESSAGE_STAGES: [
    { key: 'thank_you', day: 0, label: 'thank you' },
    { key: 'care_check', day: 3, label: 'care' },
    { key: 'feedback', day: 7, label: 'feedback' },
    { key: 'upsell', day: 14, label: 'upsell' },
    { key: 'referral', day: 30, label: 'referral' },
  ],

  // ── Light access gate (Phase 1) ─────────────────────────────
  GATE_PASSCODE: 'harshul',
  GATE_KEY: 'hrs_gate_ok',

  TZ: 'Asia/Kolkata',
};
