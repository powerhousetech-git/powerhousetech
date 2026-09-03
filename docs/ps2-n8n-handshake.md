# PS2 — Portal handshake (Cursor → n8n)

**Date:** 2026-09-03
**Status:** Portal side applied. Four n8n workflows are the live integration path.

Old Google Sheets–only workflows are obsolete. The portal talks only to these n8n Cloud webhooks.

## Locked answers

| Question | Answer |
|---|---|
| Website enrichment URL | `POST https://shreyas-sinha.app.n8n.cloud/webhook/ps2-website-enrichment` with `{ event, lead_id, website }` and header `x-api-key` |
| Payload | ID + website only. n8n calls `GET ?op=lead&id=` for the full row |
| Reply polling | n8n Gmail trigger every 15 min. Portal does not POST inbound replies. Workflow B webhook is for a manual re-run only |

## Webhooks saved in System Settings

| Key | URL | n8n ID |
|---|---|---|
| `send_email` | `https://shreyas-sinha.app.n8n.cloud/webhook/ps2-send-email` | `4LukaFFhxKQMceTf` |
| `process_replies` | `https://shreyas-sinha.app.n8n.cloud/webhook/ps2-process-replies` | `3P7CsPNybLQfCVoB` |
| `sync_sheets` | `https://shreyas-sinha.app.n8n.cloud/webhook/ps2-sync-sheets` | `W0HLYxXT3BcFBARU` |
| `enrich_website` | `https://shreyas-sinha.app.n8n.cloud/webhook/ps2-website-enrichment` | `OEKnJlD68UwnFoPj` |

Shared `N8N_API_KEY` is stored in `ps2_system_settings` (and should also be set as the Edge Function secret). It is not committed to git.

## Portal behaviour n8n can rely on

- `GET ?op=settings` is allowed for the n8n API-key actor so Workflows A/B can read AI prompts. PATCH remains `pt_admin` only.
- New lead with a `website` → portal POSTs Workflow D (`enrich_website`), not the sheets webhook.
- Outbound portal → n8n calls include `x-api-key`.
- Bulk upsert for Workflow C: `POST ?op=leads-import` with `{ source: "google_sheet", upsert: true, leads: [...] }`. Duplicate emails update; new emails insert. Then `PATCH ?op=sheet-connection&id=` with `last_synced_at`.

## Still needed on the n8n side

1. Header Auth credential `x-api-key` assigned to every HTTP Request node.
2. Workflow C should POST `?op=leads-import` (not a Google Sheet write-back as the source of truth).
3. Optional later: PDF card extraction webhook `extract_pdf` / Workflow E. Until then, Capture records the file and staff can add the contact manually.
4. Switch Workflow B from Gmail to Microsoft Outlook when Sahasra confirm O365 vs on-prem.
