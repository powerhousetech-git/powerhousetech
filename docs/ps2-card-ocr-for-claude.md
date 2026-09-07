# Claude task — `ps2-card-ocr` webhook

Portal Capture (business card PDF/image) POSTs **one image at a time** to:

`POST https://shreyas-sinha.app.n8n.cloud/webhook/ps2-card-ocr`

Auth: `x-api-key` (+ `Shreyas09` same value).

## Request (matches live WF)

```json
{ "image_base64": "<png/jpeg base64 without data-url prefix>" }
```

Optional: `filename` for logging.

PDF uploads are rendered client-side to PNG pages; each page is a separate POST.

## Preferred response (Respond to Webhook)

Return a single contact object:

```json
{
  "name": "",
  "email": "",
  "phone": "",
  "company": "",
  "designation": "",
  "website": ""
}
```

Portal shows a review card with **+ Add Lead**; user confirms before `ps2-add-lead`.

Empty body / Respond Immediately → portal shows an OCR error toast for that card.

Workflow ID (Claude): `DV9TMESUR0XrXtBv` · name: **PS2 Card OCR**.
