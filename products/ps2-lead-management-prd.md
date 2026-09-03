# PS2 — Lead Management Portal PRD

**Product:** PS2 Lead Management Portal  
**Client:** Sahasra Group  
**Built by:** PowerhouseTech  
**Stack:** Next.js App Router, Supabase, n8n, Claude AI

## 1. Overview

Two-segment portal:
1. **Lead capture & outreach** — ingest leads (PDF business cards, Excel, Google Sheets, manual), store in master DB, run automated Outlook email sequences via n8n with Claude personalisation/sentiment.
2. **Client tracker** — converted leads become projects tracked through stages (Kanban + table).

## 2. Roles

| Role | Access |
|------|--------|
| `sahasra_admin` | Full app except `/settings/system` |
| `sahasra_employee` | App minus `/settings/users`, `/mail-config` |
| `pt_admin` | `/settings/system` only |

Default admin: `sahasra_admin` / `sahasra_admin`

## 3–5. Features

See implementation under `ps2/` (pages, APIs, UI).

## 6. Database Schema

All tables live in `public` with `ps2_` prefix to avoid collisions with existing PowerhouseTech tables. Logical names map 1:1 to PRD entities.

### 6.1 organizations → `ps2_organizations`

```sql
id uuid PK default gen_random_uuid()
name text not null
created_at timestamptz default now()
```

### 6.2 users → `ps2_users`

```sql
id uuid PK
organization_id uuid FK → ps2_organizations
username text unique not null
password_hash text not null
full_name text
role text check (sahasra_admin | sahasra_employee | pt_admin)
outlook_account text
is_active boolean default true
created_at, updated_at timestamptz
```

### 6.3 leads → `ps2_leads`

```sql
id uuid PK
organization_id uuid FK
first_name, last_name, full_name text
company, designation, email, phone, website text
website_summary text
status text  -- new | mail_1_sent | follow_up_1..10 | responded | meeting_scheduled | converted | discarded
source text  -- business_card | excel | google_sheet | manual
assigned_to uuid FK → ps2_users
tags text[] default '{}'
custom_intro text
notes text
meeting_scheduled_at timestamptz
upload_batch_id uuid FK → ps2_upload_batches
last_activity_at timestamptz
created_at, updated_at timestamptz
```

### 6.4 lead_emails → `ps2_lead_emails`

```sql
id uuid PK
lead_id uuid FK
direction text  -- outbound | inbound
subject, body text
sentiment text  -- positive | neutral | negative | null
sequence_step int
status text  -- draft | pending_review | approved | sent | rejected
is_ai_draft boolean default false
sent_at, received_at, created_at timestamptz
created_by uuid FK → ps2_users
```

### 6.5 mail_sequence_config → `ps2_mail_sequence_config`

```sql
id uuid PK
organization_id uuid FK
step_number int  -- 1..11
label text
day_offset int default 0
subject_template text
body_template text
is_active boolean default true
updated_at timestamptz
unique (organization_id, step_number)
```

### 6.6 upload_batches → `ps2_upload_batches`

```sql
id uuid PK
organization_id uuid FK
source_type text
filename text
storage_path text
total_records, imported_count, duplicate_count, failed_count int
uploaded_by uuid FK
created_at timestamptz
```

### 6.7 google_sheet_connections → `ps2_google_sheet_connections`

```sql
id uuid PK
organization_id uuid FK
sheet_url, sheet_id, tab_name text
column_mapping jsonb default '{}'
sync_interval_hours int  -- 1|3|6|12|24
last_synced_at timestamptz
is_active boolean default true
created_by uuid FK
created_at timestamptz
```

### 6.8 client_projects → `ps2_client_projects`

```sql
id uuid PK
organization_id uuid FK
lead_id uuid FK nullable
client_name, project_name text
order_value numeric
stage text  -- enquiry_received | bid_submitted | order_won | production | quality_check | delivery | completed | on_hold
assigned_to uuid FK
target_date date
notes text
quotation_ref text
documents jsonb default '[]'
stage_entered_at timestamptz
created_at, updated_at timestamptz
```

### 6.9 stage_transitions → `ps2_stage_transitions`

```sql
id uuid PK
project_id uuid FK
from_stage, to_stage text
notes text
documents jsonb default '[]'
transitioned_by uuid FK
created_at timestamptz
```

### 6.10 system_settings → `ps2_system_settings`

```sql
id uuid PK
organization_id uuid FK
key text
value jsonb
updated_at timestamptz
unique (organization_id, key)
```

### 6.11 activity_log → `ps2_activity_log` (dashboard feed)

```sql
id uuid PK
organization_id uuid FK
actor_id uuid FK nullable
entity_type, entity_id text
action text
summary text
metadata jsonb
created_at timestamptz
```

## 7–10. UI / Auth / Design

Implemented in `ps2/` — Sahasra colours `#1a237e` / `#ffc107`, background `#f8fafc`.

## 11. API Routes

Consistent shape: `{ success: boolean, data?: any, error?: string }`

### JWT (cookie `ps2_token`)
- `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- `GET|POST /api/leads`, `GET|PATCH|DELETE /api/leads/:id`
- `POST /api/leads/bulk`, `POST /api/leads/:id/convert`
- `POST /api/leads/upload/business-card`, `POST /api/leads/upload/excel`
- `GET|POST /api/lead-emails`, `PATCH /api/lead-emails/:id`
- `GET|PATCH /api/mail-config`
- `GET /api/dashboard/stats`, `GET /api/dashboard/activity`
- `GET|POST /api/users`, `PATCH|DELETE /api/users/:id`
- `GET|POST /api/projects`, `GET|PATCH /api/projects/:id`, `POST /api/projects/:id/advance`
- `GET|PATCH /api/settings/system`
- `GET /api/settings/outlook-accounts`
- `GET|POST /api/settings/google-sheet-connections`
- `PATCH /api/settings/google-sheet-connections/:id`
- `GET /api/review-drafts`

### n8n API key (`x-api-key: N8N_API_KEY`)
- `GET /api/leads`, `PATCH /api/leads/:id`
- `POST /api/lead-emails`
- `PATCH /api/leads/:id/website-summary`
- `GET /api/mail-config`
- `GET /api/settings/outlook-accounts`
- `GET|PATCH /api/settings/google-sheet-connections[/:id]`

## 12. Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
JWT_SECRET=
N8N_API_KEY=
ANTHROPIC_API_KEY=
PS2_DEMO_MODE=true   # optional local in-memory store when service key absent
```
