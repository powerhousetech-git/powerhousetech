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

Portal Capture → PDF/image dropzone converts PDF pages to PNG base64, then POSTs:

```json
{
  "event": "card.ocr",
  "filename": "cards.pdf",
  "content_type": "application/pdf",
  "page_count": 2,
  "pages": [
    { "page": 1, "content_type": "image/png", "content_base64": "<…>" },
    { "page": 2, "content_type": "image/png", "content_base64": "<…>" }
  ]
}
```

For a single image, `content_base64` is also set at the top level (same bytes as `pages[0]`).

**Preferred response** (use **Respond to Webhook**, not Respond Immediately):

```json
{
  "contacts": [
    {
      "name": "Priya Sharma",
      "email": "priya@example.com",
      "phone": "+91…",
      "company": "Acme",
      "designation": "CTO",
      "website": "https://acme.com"
    }
  ]
}
```

Portal then dedupes by email and writes via `ps2-add-lead`.

Alternatives the portal also accepts:
- `{ "leads": [ … ] }`
- `{ "imported": 2 }` if n8n already wrote rows to the sheet
- Flat single contact object

If the webhook only acks with `{"message":"Workflow was started"}`, the portal shows “Queued for OCR” and expects n8n to write leads itself.

Auth header: `x-api-key` (also send `Shreyas09` for handshake compat).

## Auth

Portal uses Option A — local admin session, no Supabase login.
