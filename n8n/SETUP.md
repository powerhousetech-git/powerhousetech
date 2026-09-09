# n8n outreach workflows

## Status

| File | In this repo? |
|---|---|
| `01_lead_discovery.json` | ✅ Present |
| `02_email_resolver.json` | ✅ Present |
| `03_sequence_engine.json` | ✅ Present |
| `04_reply_monitor.json` | ✅ Present |

All four files already have the Supabase base URL (`https://msratyvmnuvozuthgkmi.supabase.co/functions/v1/outreach-api`) and the `Authorization: Bearer` portal token baked in on every portal HTTP node — no `REPLACE_PORTAL_BASE_URL` / `REPLACE_PORTAL_API_KEY` placeholders remain. You still need to fill in:

- `REPLACE_APOLLO_KEY_1` … `4` in `01_lead_discovery.json`
- `REPLACE_ANTHROPIC_API_KEY` (or swap for an HTTP Header Auth credential) in `03_sequence_engine.json`
- `REPLACE_GMAIL_CREDENTIAL_ID` (Gmail OAuth2 credential) in `03_sequence_engine.json` and `04_reply_monitor.json`

**Portal is already built** in `/portal` (Cursor). Read **[COWORK_HANDOFF.md](./COWORK_HANDOFF.md)** first.

## Placeholders still in the JSON files

| Placeholder | Replace with |
|---|---|
| `REPLACE_APOLLO_KEY_1` … `4` | Apollo API keys (workflow 01) |
| `REPLACE_ANTHROPIC_API_KEY` | Anthropic key, header `x-api-key` (workflow 03) — or swap for an HTTP Header Auth credential |
| `REPLACE_GMAIL_CREDENTIAL_ID` | Gmail OAuth2 credential id (workflows 03 & 04) |

The portal base URL and `Authorization: Bearer` API key are **already hardcoded** into every portal HTTP Request node (Supabase Edge Function, not a local/proxy URL — see `PRODUCTION.md`). `patch-portal-auth.js` is only needed if you point these workflows at a different (e.g. local dev) portal instance.

## Auth header (already set on every portal HTTP Request node)

```
Authorization: Bearer 2e5559ab3d6c6c520534ad11841227924392e7a6d97f9bfb
```

Without this, the portal returns `401 Sign in required`.  
Google admin login (`shreyas@powerhousetech.in`) is **only** for the dashboard UI — not for n8n.

## Patch helper (optional — only for local/dev portal URLs)

```bash
PORTAL_BASE_URL=http://localhost:3000 \
PORTAL_API_KEY=your-secret \
node n8n/patch-portal-auth.js --apply
```

## Import / activate

1. Import all four JSON files into n8n.
2. Fill in the placeholders from the table above (Apollo keys, Anthropic key, Gmail OAuth2 credential).
3. Smoke-test: `curl -H "Authorization: Bearer $KEY" https://msratyvmnuvozuthgkmi.supabase.co/functions/v1/outreach-api/api/contacts?limit=1`
4. Then activate schedules (01 every 3h, 02 hourly, 03 daily 08:00 IST, 04 every 2h).
