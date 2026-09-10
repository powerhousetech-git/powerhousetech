# Harshul Tiles & Fittings — Dashboard

The operational command centre for a tiles / sanitaryware / bath-fittings
showroom in Madhya Pradesh. It gives the owner a single morning view of the
post-sale WhatsApp follow-up engine, employee accountability, and pending tasks.

> **Isolation:** This app is 100% self-contained in `clients/harshul/dashboard/`.
> It does not import from or reference any other Powerhouse client (Sahasra, PS2,
> medspa, etc.) or root-level website code.

## What it does

The dashboard is a **control panel**, not a message engine. WhatsApp messages are
sent by **n8n + Evolution API**; the dashboard reads/writes **Google Sheets** and
pokes **n8n webhooks**.

| Page | Purpose |
| --- | --- |
| **Home / Daily Digest** | KPI cards, today's action list (grouped by employee), yesterday's summary + employee scorecard, 7-day trend chart |
| **Follow-Ups** | Task list with tabs (All / My Tasks / Overdue / Completed), mark-done, snooze, reassign, add note, add follow-up, performance sidebar |
| **Message Log** | All WhatsApp messages with date/status/template filters, customer search, CSV export |
| **Templates** | CRUD for message templates + live WhatsApp chat-bubble preview |
| **Upsell Rules** | CRUD for product → upsell mapping (Hindi + English messages) |
| **Settings** | WhatsApp connection status + QR re-scan, business name, notification schedule, employees, review link, n8n webhook URLs |

## Tech

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** (warm, earthy tiles palette) — mobile-first, Hindi sub-labels
- **Recharts** for charts
- **Google Sheets** via the REST API, authenticated with a service-account JWT
  built using Node's `crypto` (no heavyweight `googleapis` dependency)
- Simple password gate (httpOnly cookie) — no user roles (Phase 1)

## Demo mode

If `GOOGLE_SERVICE_ACCOUNT_KEY` + `SPREADSHEET_ID` are **not** set, the app runs
in **DEMO MODE**: all reads/writes go to an in-memory store seeded with realistic
fixture data (Hindi customer names, tiles products, employees Mohit/Raju/Suresh).
This makes the whole dashboard clickable without any credentials. A "DEMO MODE"
badge appears in the top bar. Restarting the server resets demo data.

## Getting started

```bash
cd clients/harshul/dashboard
cp .env.example .env.local   # edit values (default password: harshul123)
npm install
npm run dev                  # http://localhost:3000
```

Build for production (runs as a Node server — required for the API routes):

```bash
npm run build
npm start
```

## Environment variables

See `.env.example`. Summary:

- `GOOGLE_SERVICE_ACCOUNT_KEY` — path to a service-account JSON file **or** the
  raw JSON string. `SPREADSHEET_ID` — the Google Sheet ID.
- `EVOLUTION_API_URL` / `EVOLUTION_API_KEY` / `EVOLUTION_INSTANCE_NAME` — WhatsApp
  gateway (used only for connection-status checks + QR).
- `N8N_WEBHOOK_BASE` + `N8N_*_PATH` — the automation webhooks.
- `DASHBOARD_PASSWORD` — the login password.
- `BUSINESS_NAME`, `GOOGLE_REVIEW_URL` — template/business defaults.

## Google Sheets schema

The column names below are matched **exactly** (n8n depends on them). Boolean
columns (`active`) are stored as `TRUE`/`FALSE`.

- **Sales:** `sale_id, date, customer_name, phone, product_category, product_sku, quantity, amount, salesperson, msg_sequence_status`
- **Messages:** `msg_id, sale_id, phone, customer_name, template_id, message_body, media_url, send_at, status, sent_at, delivered_at, read_at, error`
- **Follow_Ups:** `ticket_id, sale_id, customer_name, phone, task, description, assigned_to, assigned_phone, due_date, status, created_at, done_at, done_by, notes`
- **Templates:** `template_id, language, body, media_url, delay_days, condition_field, condition_value, active, created_at, updated_at`
- **Upsell_Rules:** `rule_id, product_category, upsell_product, message_hi, message_en, image_url, active`
- **Employees:** `employee_id, name, phone, role, active`

Create one tab per sheet with the header row exactly as above.

## API routes

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/auth/login`, `/api/auth/logout` | POST | Password gate |
| `/api/stats` | GET | Daily-digest KPIs, yesterday summary, scorecard, trend |
| `/api/followups` | GET/POST/PATCH | List, create, update/reassign/snooze |
| `/api/mark-done` | POST | Notify n8n (`/hrs-mark-done`) + update sheet |
| `/api/send-now` | POST | Ask n8n to send now (`/hrs-send-now`) |
| `/api/messages` | GET | Message log |
| `/api/templates` | GET/POST/PUT/DELETE | Template CRUD |
| `/api/upsell-rules` | GET/POST/PUT/DELETE | Upsell CRUD |
| `/api/employees` | GET/POST/PUT/DELETE | Employee CRUD |
| `/api/settings` | GET/PUT | Business config + webhook URLs |
| `/api/evolution` | GET | WhatsApp connection state + QR endpoint |

> Note: the original spec sketched API handlers under `src/api/`. In the Next.js
> App Router, route handlers must live under `src/app/api/**/route.ts`, so that's
> where they are.

## Not in scope (Phase 1)

- No WhatsApp sending engine (that's n8n's job — the dashboard only calls webhooks).
- No local database — Google Sheets is the source of truth.
- No user roles/permissions beyond the password gate.
