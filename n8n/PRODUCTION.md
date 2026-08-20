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

Find-replace any `trycloudflare.com` / `localhost:3000` base URL to the Supabase URL above, keep the Bearer key, re-import workflows.

You still configure in n8n manually:

1. Gmail OAuth2 → workflows 03 & 04  
2. Anthropic key (HTTP Header Auth, `x-api-key`) → workflow 03  
