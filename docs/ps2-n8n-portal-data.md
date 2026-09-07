# PS2 portal ↔ n8n (Supabase retired)

Portal static app at `sahasra/lead-management/` talks **only** to n8n.

## Reads — `GET /webhook/ps2-portal-data?op=…`

| `op` | Expected body |
|------|----------------|
| `leads` | Array of sheet rows (Title Case columns OK) |
| `mail-config` | Array of sequence step rows |
| `settings` | Array of `{ key, value }` rows |
| `email-log` | Array of email log rows |

**Important:** the webhook must use **Respond to Webhook** with the sheet JSON. If n8n is set to *Respond Immediately*, the portal only receives `{"message":"Workflow was started"}` and cannot render leads.

## Writes (unchanged)

- `POST /webhook/ps2-add-lead`
- `POST /webhook/ps2-update-lead`
- `POST /webhook/ps2-send-email`
- `POST /webhook/ps2-process-replies`
- `POST /webhook/ps2-website-enrichment`
- `POST /webhook/ps2-card-ocr` — business card PDF/image OCR (Claude vision)

### Card OCR — `POST /webhook/ps2-card-ocr`

Portal sends **one page/image per request** (Claude vision WF):

```json
{ "image_base64": "<png base64>" }
```

**Preferred response** (Respond to Webhook) — single contact:

```json
{ "name": "", "email": "", "phone": "", "company": "", "designation": "", "website": "" }
```

Portal shows review cards; user clicks **+ Add Lead** → `ps2-add-lead`.

Auth header: `x-api-key` (also send `Shreyas09` for handshake compat).

## Auth

Portal uses Option A — local admin session, no Supabase login.
