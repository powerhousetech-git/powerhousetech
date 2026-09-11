# Harshul Tiles & Fittings — Dashboard

A **read-only** monitoring dashboard for **Harshul Tiles & Fittings** (a tiles &
bathroom-fittings retailer in Madhya Pradesh). It surfaces the two automated
WhatsApp services powered by **n8n + Evolution API**:

1. **Post-Sale Message Automation** — scheduled WhatsApp messages (thank you →
   care check → feedback → upsell → referral at Day 0/3/7/14/30 after a sale).
2. **Follow-Up Notification Engine** — reads the Google Sheet, detects overdue
   client follow-ups, pings employees, escalates to the owner.

The dashboard reads from the **same Google Sheet** the n8n workflows use. It
performs **no writes** — all writes happen through n8n.

> **Isolation:** self-contained in `clients/harshul/dashboard/`. No shared code
> with Sahasra / PS2 / other Powerhouse clients.

## The AI-mapping pattern (core)

Sheet columns are AI-generated and may be Hindi / English / mixed. An `AI_Config`
tab stores the mapping as two rows: **row 1 = standard keys**, **row 2 = the
actual Sheet1 column headers**. Every data fetch reads `AI_Config` first, then
applies the mapping to normalize `Sheet1`. Column names from `Sheet1` are **never
hardcoded**.

Standard keys: `customer_name, customer_phone, next_follow_up_date,
assigned_employee, product_category, status, sale_amount, notes, sale_date`.

## Tech

- **Next.js 14** (App Router) + TypeScript, `output: 'standalone'` for Docker
- **Tailwind CSS 3** — deep-blue (#1e3a5f) / teal (#0d9488) palette, dark mode, Inter
- **Recharts** — messages/day bar, follow-up pie, post-sale funnel
- **NextAuth.js** — Google OAuth restricted to `ALLOWED_EMAIL`
- **Google Sheets API v4** (read-only) via a service account
- All date comparisons in **IST (Asia/Kolkata)**

## Pages

| Route | Content |
| --- | --- |
| `/` | KPIs (clients, sent today, pending, overdue, employees), messages/day, follow-up pie, post-sale funnel, recent activity |
| `/post-sale` | Scheduled messages table + status/type/date filters + success rate |
| `/follow-ups` | AI-mapped client list, colour-coded (red/yellow/green), employee/status/date filters, overdue badge |
| `/employees` | Per-employee scorecards (assigned / overdue / due today / on-track %), expand to list clients |
| `/settings` | Live AI mapping, last refresh, Evolution ping, n8n workflow links |

## API routes

`GET /api/dashboard`, `/api/messages`, `/api/follow-ups`, `/api/employees`,
`/api/config`, `/api/health`. Each reads `AI_Config` first, applies the mapping,
and returns standardized JSON. NextAuth lives at `/api/auth/[...nextauth]`.

## Demo mode

Without credentials the dashboard is still fully usable for review:

- **No `GOOGLE_SERVICE_ACCOUNT_KEY`** → data comes from in-memory fixtures that
  mirror the real sheet shape (a demo `AI_Config` with Hindi headers + `Sheet1`
  rows keyed by them, so the mapping pipeline is genuinely exercised). A
  `DEMO MODE` banner is shown.
- **No `GOOGLE_CLIENT_ID/SECRET`** → the Google-OAuth gate is bypassed.

Caching: AI mapping 5 min, sheet data 1 min.

## Local development

```bash
cd clients/harshul/dashboard
cp .env.example .env.local   # fill in values (optional for demo mode)
npm install
npm run dev                  # http://localhost:3000
```

## Environment variables

See `.env.example`. Key ones: `GOOGLE_SERVICE_ACCOUNT_KEY` (service-account JSON,
read-only), `SHEET_ID` (defaults to the Harshul sheet), `NEXTAUTH_SECRET`,
`NEXTAUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ALLOWED_EMAIL`,
`EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE_NAME`, `N8N_BASE_URL`.

## Docker

```bash
docker compose up -d --build      # exposes http://localhost:3001
```

On the shared VPS, merge the `harshul-dashboard` service from `docker-compose.yml`
into the existing compose file alongside `evolution-api` + `n8n` so it can reach
them on the internal Docker network.

## Evolution API (WhatsApp gateway)

The WhatsApp sends run through **Evolution API** (driven by n8n; the dashboard
only reads its status). For a **one-click managed deploy** on **Render** or
**Railway** — no VPS to manage — see [`deploy/evolution/README.md`](./deploy/evolution/README.md)
(includes the `render.yaml` blueprint, the Railway template link, QR linking, and
how to wire `EVOLUTION_API_URL/KEY/INSTANCE` back into this dashboard and n8n).

## Google Sheet

**Sheet ID:** `1BbtJp8j0HxFVxvEdyakjk8P4FMUL3l-FyJrgR2IO6mY`

| Tab | Purpose |
| --- | --- |
| `Sheet1` | Client/sales data (columns vary — mapped via `AI_Config`) |
| `AI_Config` | Row 1 = standard keys, Row 2 = actual `Sheet1` headers |
| `Messages` | `sale_id, customer_name, customer_phone, product, message_type, scheduled_date, status, sent_at, created_at` |
| `Employees` | `Name, Phone, Role` |

Share the sheet (Viewer) with the service-account email.

## Linked n8n workflows

`HRS_AI_SCHEMA_MAP`, `HRS_FU_01_AI_FollowUp_Checker`, `HRS_PS_01_AI_New_Sale_Ingest`,
`HRS_PS_02_AI_Message_Sender`, `HRS_DD_01_AI_Daily_Digest` — deep-linked on the
Settings page.
