# PS2 — Portal ↔ n8n handshake

**Updated:** 2026-09-04  
**Status:** Mutual handshake complete. Portal and n8n agree on the live API contract.

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
| `extract_pdf` | _(empty — reserved for WF-E)_ | — |

Shared `N8N_API_KEY` is stored in `ps2_system_settings` (and should also be set as the Edge Function secret). It is not committed to git.

## Confirmed n8n → portal endpoints

| Workflow | Ops |
|---|---|
| A — Email sequence | `leads-ready-to-send`, `lead`, `email`, `mail-config`, `settings`, `outlook-accounts` |
| B — Reply ingestion | `lead-by-email`, `lead`, `email`, `settings` |
| C — Sheets sync | `sheet-connections`, `leads-import`, `sheet-connection` |
| D — Website enrichment | `lead` GET + PATCH (`website_summary`) |

Claude confirmed (2026-09-04):

- **WF-C** upsert node → `POST ?op=leads-import` with `{ source: "google_sheet", upsert: true, leads: [...] }`
- **WF-B** lookup node → `GET ?op=lead-by-email&email=`

## Portal behaviour n8n can rely on

- `GET ?op=settings` is allowed for the n8n API-key actor so Workflows A/B can read AI prompts. PATCH remains `pt_admin` only.
- New lead with a `website` → portal POSTs Workflow D (`enrich_website`) with `x-api-key`.
- `leads-import`: duplicate emails update when `upsert: true` or `source: "google_sheet"`; new emails insert. Then n8n should `PATCH ?op=sheet-connection&id=` with `last_synced_at`.

## Still outstanding (n8n / ops — not portal code)

1. **Header Auth:** assign the `x-api-key` Header Auth credential on every HTTP Request node (manual in n8n UI; currently `PLAIN_GENERIC_AUTH` warnings).
2. **WF-E:** exhibition PDF OCR — reserved webhook key `extract_pdf`; not built yet. Capture still records the file; staff can add the contact manually.
3. **Outlook:** blocked on Sahasra IT (O365 vs on-prem). Stay on Gmail poll until confirmed.
