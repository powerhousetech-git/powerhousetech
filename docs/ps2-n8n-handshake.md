# PS2 — Portal ↔ n8n handshake (v6)

**Updated:** 2026-09-04  
**Architecture:** Google Sheet = master lead DB. Supabase Edge Function = auth, settings, mail config, drafts, email log, client projects.

## Master sheet

| Item | Value |
|---|---|
| Sheet ID | `1UxKqqC5unE3CwTMqgpB3SMARfxIIw2sVSZQUuz3SclU` |
| URL | https://docs.google.com/spreadsheets/d/1UxKqqC5unE3CwTMqgpB3SMARfxIIw2sVSZQUuz3SclU |
| Tab | `Sheet1` (rotate every ~1000 rows) |
| Lead identity | **Email** (not UUID) |

Columns: Name, Email, Phone, Company, Designation, Website, Source, Status, Follow Up Count, Website Summary, Last Email Sent, Created At, Notes.

## Portal behaviour (v6)

| Page | Data source |
|---|---|
| Dashboard KPIs / funnel | Sheet via `GET ?op=sheet-leads` |
| Leads Database | Read-only sheet iframe (`htmlview`) |
| Pipeline Kanban | Sheet rows (portal-built) |
| Capture / status edits | n8n webhooks `ps2-add-lead` / `ps2-update-lead` |
| Website enrichment | `POST …/ps2-website-enrichment` body `{ event, email, website }` |
| Review AI Replies | Supabase drafts / emails |
| Mail config, users, projects | Supabase |

## Webhooks

| Key | URL | Owner |
|---|---|---|
| `send_email` | `…/webhook/ps2-send-email` | WF-A |
| `process_replies` | `…/webhook/ps2-process-replies` | WF-B |
| `sync_sheets` | `…/webhook/ps2-sync-sheets` | WF-C |
| `enrich_website` | `…/webhook/ps2-website-enrichment` | WF-D |
| **`add_lead`** | `…/webhook/ps2-add-lead` | **NEW — Claude to create** |
| **`update_lead`** | `…/webhook/ps2-update-lead` | **NEW — Claude to create** |

Portal sends both `x-api-key` and `Shreyas09` with the shared key.

### Add lead body
```json
{ "action": "create", "event": "lead.create", "name": "…", "email": "…", "company": "…", "phone": "…", "designation": "…", "website": "…", "source": "manual|csv|pdf|sheets", "notes": "…" }
```

### Update lead body
```json
{ "action": "update", "event": "lead.update", "email": "priya@…", "status": "meeting_scheduled|converted|discarded|…", "name": "…", "company": "…", … }
```
Match sheet row by **Email**; `appendOrUpdate`.

### Enrichment body (changed in v6)
```json
{ "event": "lead.created", "email": "priya@syska.co.in", "website": "https://www.syska.co.in" }
```

## Edge Function ops still used by portal

`login`, `me`, `sheet-leads`, `portal-settings`, `settings`, `mail-config`, `review-drafts`, `email` PATCH, `projects`, `users`, `sheet-connections`, `activity`, `trigger-n8n`, `health`

Legacy lead CRUD ops remain for transition but portal no longer uses them for master data.

## n8n status (from Claude 2026-09-04)

WF-A / B / D rewired to Google Sheets READ + `appendOrUpdate` by Email. WF-C unchanged (already writes master sheet). Settings / email log still hit Supabase.

## Go-live checklist (Claude / n8n)

1. Create **`ps2-add-lead`** webhook — append row to Sheet1.
2. Create **`ps2-update-lead`** webhook — `appendOrUpdate` by Email.
3. Confirm WF-D enrichment uses `{ email, website }` (not `lead_id`).
4. Keep Header Auth on all HTTP nodes; workflows Active.
5. Sheet sharing: Anyone with the link → Viewer (portal CSV proxy + iframe).
