window.PS2 = {
  // n8n is now the only backend
  N8N_BASE: 'https://shreyas-sinha.app.n8n.cloud',
  N8N_API_KEY: '6b1730acf3723e7276b42b11ee86757309318cc03769d0127acc365fd394fa3d',

  TOKEN_KEY: 'ps2_portal_token',

  // Google Sheet (read-only reference — n8n does the actual reads)
  SHEET_ID: '1UxKqqC5unE3CwTMqgpB3SMARfxIIw2sVSZQUuz3SclU',
  SHEET_TAB: 'Sheet1',
  SHEET_GID: '0',
  SHEET_URL: 'https://docs.google.com/spreadsheets/d/1UxKqqC5unE3CwTMqgpB3SMARfxIIw2sVSZQUuz3SclU',
  SHEET_EMBED: 'https://docs.google.com/spreadsheets/d/1UxKqqC5unE3CwTMqgpB3SMARfxIIw2sVSZQUuz3SclU/htmlview?gid=0&widget=true&headers=false',

  N8N_WEBHOOKS: {
    portal_data: '/webhook/ps2-portal-data',
    send_email: '/webhook/ps2-send-email',
    process_replies: '/webhook/ps2-process-replies',
    enrich_website: '/webhook/ps2-website-enrichment',
    add_lead: '/webhook/ps2-add-lead',
    update_lead: '/webhook/ps2-update-lead',
  },
};
