# Permanent outreach API (for Cowork / n8n)

Production is live on Supabase (Railway is optional / unused).

```
PORTAL_BASE_URL=https://msratyvmnuvozuthgkmi.supabase.co/functions/v1/outreach-api
PORTAL_API_KEY=2e5559ab3d6c6c520534ad11841227924392e7a6d97f9bfb
```

Auth for n8n HTTP nodes:

```
Authorization: Bearer 2e5559ab3d6c6c520534ad11841227924392e7a6d97f9bfb
```

`PORTAL_API_KEY` is also stored in Supabase table `outreach_portal_config` (key=`api_key`).

Dashboard (admin Google login): https://powerhousetech.in/outreach/

Endpoints (same contract as local Express portal):

- `GET  {BASE}/api/health` (no auth)
- `GET  {BASE}/api/contacts`
- `POST {BASE}/api/contacts`
- `PATCH {BASE}/api/contacts/:id`
- `GET  {BASE}/api/stats`
- `GET  {BASE}/api/config` — email cadence (`sequenceDay1/2/3`) for workflow 03
- `PUT  {BASE}/api/config` — update cadence (admin)
- `POST {BASE}/api/triggers/discover` (admin) — fire n8n workflow 01
- `POST {BASE}/api/triggers/mail` body `{ "track": "A"|"B" }` (admin) — fire workflow 03

Default cadence: Day 1 = 1, Day 2 = 4, Day 3 = 9. Status labels (`Day1 Sent` / `Day4 Sent` / `Day9 Sent`) stay as sequence position names.

n8n webhook URLs are stored in `outreach_portal_config` (`n8n_webhook_base_url`, `n8n_discover_path`, `n8n_mail_path`).

Controls UI: https://powerhousetech.in/outreach/controls

Find-replace any `trycloudflare.com` / `localhost:3000` base URL to the Supabase URL above, keep the Bearer key, re-import workflows.

You still configure in n8n manually:

1. Gmail OAuth2 → workflows 03 & 04  
2. Anthropic key (HTTP Header Auth, `x-api-key`) → workflow 03  
3. Activate workflows 01 & 03 so webhook triggers work from Controls  
