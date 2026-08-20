# n8n outreach workflows

Drop the four workflow JSON files here (from the Claude build pack):

- `01_lead_discovery.json`
- `02_email_resolver.json`
- `03_sequence_engine.json`
- `04_reply_monitor.json`

They are not in this repo yet. When you add them:

## Placeholders to replace

| Placeholder | Value |
|---|---|
| `REPLACE_PORTAL_BASE_URL` | Outreach portal origin, e.g. `http://localhost:3000` |
| `REPLACE_APOLLO_KEY_1` … `4` | Apollo API keys |
| `REPLACE_ANTHROPIC_API_KEY` | Anthropic key |

## Auth header for portal HTTP nodes

```
Authorization: Bearer <PORTAL_API_KEY>
```

Use the same secret as `portal/.env` → `PORTAL_API_KEY`.

## Import

1. Start the portal (`cd portal && npm start`).
2. In n8n: Import from file for each JSON.
3. Configure Gmail OAuth2 for workflows 03 and 04.
4. Smoke-test `GET /api/contacts` with the API key before activating schedules.
