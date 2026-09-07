# Claude — fix `ps2-add-lead` (writes not landing)

## Symptom
Portal OCR / Capture reports “saved”, but Sheet1 does **not** get new rows (`spamprivacy02@gmail.com`, `yashsinham@gmail.com` missing).

## Root cause
`POST /webhook/ps2-add-lead` returns in ~0.25s:

```json
{"message":"Workflow was started"}
```

That is **Respond Immediately**. Portal previously treated HTTP 200 as success (false positive). Sheet append either isn’t running or isn’t confirmed.

## Required fix (n8n WF `ps2-add-lead`, id `uZuVpnEK1RzHtRbW`)

1. Webhook → Response Mode = **Using Respond to Webhook Node**
2. Google Sheets **Append** (or AppendOrUpdate by Email) to master sheet:
   - Spreadsheet: `1UxKqqC5unE3CwTMqgpB3SMARfxIIw2sVSZQUuz3SclU`
   - Tab: `Sheet1`
   - Map fields: Name, Email, Phone, Company, Designation, Website, Source, Status, …
3. After successful append, **Respond to Webhook** with e.g.:
```json
{ "ok": true, "email": "…", "name": "…" }
```
4. On failure, respond `{ "ok": false, "error": "…" }` — never empty body / bare ack.

### Request body portal sends
```json
{
  "action": "create",
  "event": "lead.create",
  "name": "…",
  "full_name": "…",
  "email": "…",
  "phone": "…",
  "company": "…",
  "designation": "…",
  "website": "…",
  "source": "pdf",
  "status": "new",
  "notes": ""
}
```

Auth: `x-api-key` + `Shreyas09`.

## Verify
After fix, POST a test lead → response JSON with `ok:true` → row visible in Sheet1 and in `GET /webhook/ps2-portal-data?op=leads`.
