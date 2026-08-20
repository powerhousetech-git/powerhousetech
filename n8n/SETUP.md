# n8n outreach workflows

## Status

| File | In this repo? |
|---|---|
| `01_lead_discovery.json` | Drop from Cowork when ready |
| `02_email_resolver.json` | Drop from Cowork when ready |
| `03_sequence_engine.json` | Drop from Cowork when ready |
| `04_reply_monitor.json` | Drop from Cowork when ready |

**Portal is already built** in `/portal` (Cursor). Read **[COWORK_HANDOFF.md](./COWORK_HANDOFF.md)** first.

## Placeholders

| Placeholder | Replace with |
|---|---|
| `REPLACE_PORTAL_BASE_URL` | Portal origin, e.g. `http://localhost:3000` |
| `REPLACE_PORTAL_API_KEY` | Same as `portal/.env` → `PORTAL_API_KEY` |
| `REPLACE_APOLLO_KEY_1` … `4` | Apollo API keys (workflow 01) |
| `REPLACE_ANTHROPIC_API_KEY` | Anthropic key (workflow 03) |

## Auth header (required on every portal HTTP Request node)

```
Authorization: Bearer REPLACE_PORTAL_API_KEY
```

Without this, the portal returns `401 Sign in required`.  
Google admin login (`shreyas@powerhousetech.in`) is **only** for the dashboard UI — not for n8n.

## Patch helper

```bash
# After copying the 4 JSON files into this folder:
node n8n/patch-portal-auth.js

# Or replace placeholders in one shot:
PORTAL_BASE_URL=http://localhost:3000 \
PORTAL_API_KEY=your-secret \
node n8n/patch-portal-auth.js --apply
```

## Import / activate

1. `cd portal && npm start` (API at `http://localhost:3000`).
2. Patch + import each JSON into n8n.
3. Gmail OAuth2 for workflows 03 and 04.
4. Smoke-test: `curl -H "Authorization: Bearer $KEY" http://localhost:3000/api/contacts?limit=1`
5. Then activate schedules (01 every 3h, 02 hourly, 03 daily 08:00 IST, 04 every 2h).
