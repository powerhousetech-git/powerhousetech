# Permanent outreach API (for Cowork / n8n)

Railway is optional. Production API is already live on Supabase:

```
PORTAL_BASE_URL=https://msratyvmnuvozuthgkmi.supabase.co/functions/v1/outreach-api
```

Auth for n8n HTTP nodes:

```
Authorization: Bearer <PORTAL_API_KEY>
```

`PORTAL_API_KEY` is stored in Supabase table `outreach_portal_config` (key=`api_key`).
Dashboard (admin Google login): https://powerhousetech.in/outreach/

Endpoints (same contract as local Express portal):

- `GET  {BASE}/api/health` (no auth)
- `GET  {BASE}/api/contacts`
- `POST {BASE}/api/contacts`
- `PATCH {BASE}/api/contacts/:id`
- `GET  {BASE}/api/stats`

Find-replace any `trycloudflare.com` / `localhost:3000` base URL to the Supabase URL above, keep the Bearer key, re-import workflows.

You still configure in n8n manually:

1. Gmail OAuth2 → workflows 03 & 04  
2. Anthropic key → workflow 03  
