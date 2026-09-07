# Claude task — `ps2-card-ocr` webhook

Portal Capture (business card PDF/image) now POSTs to:

`POST https://shreyas-sinha.app.n8n.cloud/webhook/ps2-card-ocr`

Auth: `x-api-key` (+ `Shreyas09` same value).

## What to build

1. Webhook path `/webhook/ps2-card-ocr` (Active).
2. Use **Claude** (Anthropic / vision) to extract contacts from each page image.
3. Prefer **Respond to Webhook** with JSON so the portal can write leads immediately.

### Request body (from portal)

```json
{
  "event": "card.ocr",
  "filename": "cards.pdf",
  "content_type": "application/pdf",
  "page_count": 2,
  "pages": [
    { "page": 1, "content_type": "image/png", "content_base64": "<png>" },
    { "page": 2, "content_type": "image/png", "content_base64": "<png>" }
  ]
}
```

Images also send top-level `content_base64` (same as `pages[0]`).

### Preferred response

```json
{
  "contacts": [
    {
      "name": "",
      "email": "",
      "phone": "",
      "company": "",
      "designation": "",
      "website": ""
    }
  ]
}
```

One contact per card/page when possible. Soft-fail blurry cards (still return best-effort fields).

Portal dedupes by **email** and calls `ps2-add-lead`.

### Optional alternate

If you write rows to the Sheet yourself inside the workflow, respond with `{ "imported": N }` (and skip returning contacts), or use Respond Immediately — portal will show “Queued for OCR”.

Full contract: `docs/ps2-n8n-portal-data.md`.
