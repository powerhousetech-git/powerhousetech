# PS2 — Portal ↔ n8n handshake

**Updated:** 2026-09-04  
**Status:** Endpoint contract aligned. Live connection blocked on n8n ops (credentials + Active toggle).

Demo: Gmail. Production: swap to Outlook when Sahasra IT confirms O365.

## Locked answers

| Question | Answer |
|---|---|
| Website enrichment URL | `POST …/webhook/ps2-website-enrichment` with `{ event, lead_id, website }` |
| Payload | ID + website only. n8n `GET ?op=lead&id=` for full row |
| Reply polling | Gmail every 15 min for demo. No portal webhook for B. Outlook later |

## Webhooks (System Settings)

| Key | URL | n8n ID |
|---|---|---|
| `send_email` | `…/webhook/ps2-send-email` | `4LukaFFhxKQMceTf` |
| `process_replies` | `…/webhook/ps2-process-replies` | `3P7CsPNybLQfCVoB` |
| `sync_sheets` | `…/webhook/ps2-sync-sheets` | `W0HLYxXT3BcFBARU` |
| `enrich_website` | `…/webhook/ps2-website-enrichment` | `OEKnJlD68UwnFoPj` |
| `extract_pdf` | _(empty — WF-E)_ | — |

Portal "Run now" buttons call `POST ?op=trigger-n8n` which POSTs these URLs.

## Auth — important

- **n8n → portal:** every HTTP Request node must send header `x-api-key: <shared key>`. Assign the Header Auth credential manually on each node.
- **portal → n8n webhooks:** portal sends **both** `x-api-key` and `Shreyas09` with the same key value (compat until the n8n webhook credential header name is renamed to `x-api-key`).
- Preferred long-term: webhook Header Auth name = `x-api-key` only.

## Confirmed endpoints

| Workflow | Ops | Status |
|---|---|---|
| A | `leads-ready-to-send`, `lead`, `email`, `mail-config`, `settings`, `outlook-accounts` | ✓ |
| B | `lead-by-email`, `lead`, `email`, `settings` | ✓ Fixed |
| C | `sheet-connections`, `leads-import`, `sheet-connection` | ✓ Fixed |
| D | `lead` GET + PATCH | ✓ |
| E (optional) | `lead-attachment` → webhook `extract_pdf` with `{ event: "lead.attachment", lead_id, attachment_id, filename, content_type, content_base64 }` | reserved |

Portal also exposes `POST ?op=lead-attachment` to attach a photo/PDF to an existing lead. Set `run_ocr: true` to forward to `extract_pdf`.

## Go-live checklist (n8n)

1. Rename webhook credential header from `Shreyas09` → `x-api-key` (portal already dual-sends).
2. Assign Header Auth on every outbound HTTP Request node (~15 nodes).
3. Toggle all 4 workflows **Active**.
4. Demo on Gmail; swap A/B to Outlook for Sahasra production.
