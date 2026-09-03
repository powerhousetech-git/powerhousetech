# PS2 Lead Management — Task for Claude (n8n Workflows)

> **Context:** The PS2 Lead Management Portal is built for Sahasra Group by PowerhouseTech.
> 
> - **Portal (me — your counterpart):** Static HTML at `powerhousetech.in/sahasra/lead-management/` backed by a Supabase Edge Function `ps2-lead-api`. Handles the UI and data layer.
> - **You (Claude — n8n):** Build n8n workflows that call this portal's API endpoints using an API key. We communicate via the user (Shreyas) as relay.

---

## 1. What n8n needs to do (your job)

Build these **n8n workflows** that integrate with the PS2 portal:

### Workflow A — Outbound Email Sequence
**Trigger:** Webhook `POST /webhook/ps2-send-email` (n8n triggers itself on a schedule or manual run)

**Steps:**
1. Call `GET https://msratyvmnuvozuthgkmi.supabase.co/functions/v1/ps2-lead-api?op=leads-ready-to-send` with header `x-api-key: <N8N_API_KEY>`  
   → Returns leads whose next sequence step is due (status = `new` or `follow_up_N_due`)
2. For each lead, call Claude API to personalise the email body using `custom_intro`, `company`, `designation`, `website_summary`
3. Send email via Outlook (connected account = `lead.assigned_outlook`)
4. Call `PATCH https://...ps2-lead-api?op=lead&id=<lead_id>` to update status + record the sent email

### Workflow B — Reply Ingestion
**Trigger:** n8n polling Outlook inbox every 15 min (or webhook if Outlook supports it)

**Steps:**
1. Match inbound email to a lead by `email` address
2. Call Claude to classify sentiment: `positive | neutral | negative`
3. If positive: call Claude to draft a reply → POST to portal as a pending AI draft
4. Call `POST ps2-lead-api?op=email` to record the inbound email + sentiment
5. Call `PATCH ps2-lead-api?op=lead&id=<id>` to update status to `responded`

### Workflow C — Google Sheets Sync
**Trigger:** Schedule (interval configured per connection in portal settings)

**Steps:**
1. Call `GET ps2-lead-api?op=sheet-connections` → get list of active connections
2. For each connection: fetch the Google Sheet, map columns, upsert leads
3. Call `PATCH ps2-lead-api?op=sheet-connection&id=<id>` to update `last_synced_at`

### Workflow D — Website Summary Enrichment (optional)
**Trigger:** When a new lead is created with a `website` field

**Steps:**
1. Scrape/summarise the lead's website using Claude
2. Call `PATCH ps2-lead-api?op=lead&id=<id>` with `{ website_summary: "..." }`

---

## 2. API Contract (what the portal exposes to n8n)

**Base URL:** `https://msratyvmnuvozuthgkmi.supabase.co/functions/v1/ps2-lead-api`

**Auth header:** `x-api-key: <N8N_API_KEY>` (env var you store in n8n credentials)

All responses: `{ ok: true, data: ... }` or `{ ok: false, error: "..." }`

### Leads

| Op | Method | Endpoint | Body / Params | Returns |
|---|---|---|---|---|
| List leads ready to email | GET | `?op=leads-ready-to-send` | – | `{ leads: [...] }` |
| Get lead | GET | `?op=lead&id=<uuid>` | – | `{ lead: {...} }` |
| Get lead by email | GET | `?op=lead-by-email&email=` | – | `{ lead: {...} }` |
| Bulk import / upsert | POST | `?op=leads-import` | `{ source, leads:[], upsert? }` | `{ imported, duplicates, failed }` |
| Update lead | PATCH | `?op=lead&id=<uuid>` | `{ status, website_summary, meeting_scheduled_at, ... }` | `{ lead: {...} }` |
| List all leads | GET | `?op=leads&status=&source=&assigned_to=&page=` | – | `{ leads: [...], total }` |

**Lead statuses (sequence):**
```
new → mail_1_sent → follow_up_1 → follow_up_2 → ... → follow_up_10 → responded → meeting_scheduled → converted | discarded
```

**Lead fields available to n8n:**
```json
{
  "id": "uuid",
  "full_name": "Priya Sharma",
  "first_name": "Priya",
  "company": "Acme Corp",
  "designation": "Head of Procurement",
  "email": "priya@acme.com",
  "phone": "+91 ...",
  "website": "https://acme.com",
  "website_summary": "...",
  "status": "new",
  "source": "business_card",
  "assigned_to": "uuid",
  "assigned_outlook": "employee@sahasra.example",
  "custom_intro": "Met at Expo 2026",
  "tags": ["expo2026"],
  "last_activity_at": "2026-09-03T..."
}
```

### Emails

| Op | Method | Endpoint | Body | Returns |
|---|---|---|---|---|
| Record outbound sent | POST | `?op=email` | `{ lead_id, direction:"outbound", subject, body, sequence_step, status:"sent", sent_at }` | `{ email: {...} }` |
| Record inbound reply | POST | `?op=email` | `{ lead_id, direction:"inbound", subject, body, sentiment, received_at }` | `{ email: {...} }` |
| Save AI draft for review | POST | `?op=email` | `{ lead_id, direction:"outbound", subject, body, status:"pending_review", is_ai_draft:true }` | `{ email: {...} }` |
| Update email status | PATCH | `?op=email&id=<uuid>` | `{ status: "sent" \| "rejected" }` | `{ email: {...} }` |

### Mail Sequence Config (read-only for n8n)

| Op | Method | Endpoint | Returns |
|---|---|---|---|
| Get active steps | GET | `?op=mail-config` | `{ steps: [{step_number, label, day_offset, subject_template, body_template, is_active}] }` |

### Google Sheet Connections (for Workflow C)

| Op | Method | Endpoint | Body | Returns |
|---|---|---|---|---|
| List active connections | GET | `?op=sheet-connections` | – | `{ connections: [...] }` |
| Update last synced | PATCH | `?op=sheet-connection&id=<uuid>` | `{ last_synced_at }` | `{ connection: {...} }` |

### Outlook Accounts (for Workflow A — pick sending account)

| Op | Method | Endpoint | Returns |
|---|---|---|---|
| List accounts | GET | `?op=outlook-accounts` | `{ accounts: [{email, display_name, is_connected, user_id}] }` |

---

## 3. Handshake — configured 2026-09-03

n8n Cloud workflows are deployed. Portal settings store these URLs:

| Key | Webhook |
|---|---|
| `n8n_webhooks.send_email` | `https://shreyas-sinha.app.n8n.cloud/webhook/ps2-send-email` |
| `n8n_webhooks.process_replies` | `https://shreyas-sinha.app.n8n.cloud/webhook/ps2-process-replies` |
| `n8n_webhooks.sync_sheets` | `https://shreyas-sinha.app.n8n.cloud/webhook/ps2-sync-sheets` |
| `n8n_webhooks.enrich_website` | `https://shreyas-sinha.app.n8n.cloud/webhook/ps2-website-enrichment` |

**Auth:** same `N8N_API_KEY` both directions (`x-api-key` header). Set as Edge Function secret and/or portal System Settings. Do not commit the key.

**Q1–Q3 answers:** enrichment uses Workflow D URL with `{ event, lead_id, website }`; n8n re-fetches the lead by ID; replies are Gmail-polled (no portal webhook required).

**Workflow C upsert:** `POST ?op=leads-import` `{ source:"google_sheet", leads:[...] }`.

See `docs/ps2-n8n-handshake.md`.

---

## 4. Sequence logic for Workflow A

The portal tracks which step each lead is on. To decide which leads to email:

```
leads_ready = leads WHERE:
  - status = 'new'                        → send Mail 1 (step 1, day_offset 0)
  - status = 'mail_1_sent'
    AND last_activity_at < now() - (step2.day_offset days)  → send Follow-up 1
  - status = 'follow_up_N'
    AND last_activity_at < now() - (stepN+1.day_offset days) → send Follow-up N+1
  - status NOT IN (responded, meeting_scheduled, converted, discarded)
```

The portal's `?op=leads-ready-to-send` endpoint handles this logic for you — just call it and send whatever it returns.

---

## 5. Claude prompt templates (read from portal)

Call `GET ?op=mail-config` to get the prompt templates. But also:
- `?op=settings` returns `ai_prompt_first_email`, `ai_prompt_reply`, `ai_prompt_sentiment` — these are the exact Claude prompts configured by PowerhouseTech in the portal system settings.

Use them as the system prompt when calling the Anthropic API.

---

## 6. Summary — what you need to build

| Workflow | Trigger | Key n8n nodes |
|---|---|---|
| A — Send emails | Schedule (daily 9am IST) | HTTP Request (portal API) → Claude → Outlook → HTTP Request (update lead) |
| B — Reply ingestion | Outlook polling / webhook | Outlook trigger → Claude sentiment → Claude draft → HTTP Request (portal API) |
| C — Sheet sync | Schedule (per connection interval) | HTTP Request (get connections) → Google Sheets → HTTP Request (upsert leads) |
| D — Website enrichment | Lead created webhook from portal | HTTP Request (get lead) → Claude summarise → HTTP Request (update lead) |

---

## 7. How Workflow D is triggered

When a new lead is saved with a `website` field, the portal POSTs to `n8n_webhooks.enrich_website`:

```json
{
  "event": "lead.created",
  "lead_id": "uuid",
  "website": "https://example.com"
}
```

Header: `x-api-key: <N8N_API_KEY>`. n8n then `GET ?op=lead&id=` for the full row.

---

## 8. Extra ops added after handshake

| Op | Method | Use |
|---|---|---|
| `leads-import` | POST | Bulk insert/upsert for Excel + Workflow C. Body `{ source, filename?, batch_id?, upsert?, leads:[] }` |
| `ingest-file` | POST | PDF/image card upload. Forwards to `extract_pdf` if configured |
| `upload-batches` | GET | Recent ingest batches |
| `stats` | GET | Includes `mail_1_sent`, `follow_ups_sent`, `responses`, `conversion_rate` |

> **Open for Claude:** Workflow C should call `POST ?op=leads-import`. Optional Workflow E for `extract_pdf` if exhibition card OCR should be automated.
