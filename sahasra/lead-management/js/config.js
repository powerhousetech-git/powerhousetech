window.PS2 = {
  API: 'https://msratyvmnuvozuthgkmi.supabase.co/functions/v1/ps2-lead-api',
  TOKEN_KEY: 'ps2_portal_token',

  // v6 — Google Sheet is the master lead database
  SHEET_ID: '1UxKqqC5unE3CwTMqgpB3SMARfxIIw2sVSZQUuz3SclU',
  SHEET_TAB: 'Sheet1',
  SHEET_GID: '0',
  SHEET_URL: 'https://docs.google.com/spreadsheets/d/1UxKqqC5unE3CwTMqgpB3SMARfxIIw2sVSZQUuz3SclU',
  SHEET_EMBED: 'https://docs.google.com/spreadsheets/d/1UxKqqC5unE3CwTMqgpB3SMARfxIIw2sVSZQUuz3SclU/htmlview?gid=0&widget=true&headers=false',

  N8N_BASE: 'https://shreyas-sinha.app.n8n.cloud',
  // Shared portal ↔ n8n key (also stored in Supabase settings / Edge secret)
  N8N_API_KEY: '6b1730acf3723e7276b42b11ee86757309318cc03769d0127acc365fd394fa3d',
  N8N_WEBHOOKS: {
    send_email: '/webhook/ps2-send-email',
    process_replies: '/webhook/ps2-process-replies',
    sync_sheets: '/webhook/ps2-sync-sheets',
    enrich_website: '/webhook/ps2-website-enrichment',
    add_lead: '/webhook/ps2-add-lead',
    update_lead: '/webhook/ps2-update-lead',
  },
};
