# PowerhouseTech — Outreach Command Center

A standalone control panel for PowerhouseTech's cold email outreach. It **reads
and writes** a Google Sheet and **controls two n8n workflows** (India + US) —
status, activate/deactivate, manual "Run Now", and recent executions.

> Separate from the PS2 lead-management portal, the Sahasra/Harshul dashboards,
> and the read-only `/outreach-dashboard` analytics view. It does **not** modify
> any n8n workflow logic — it only triggers runs and toggles active state.

## Features

- **Header** — last refresh + Refresh button, dark/light theme toggle
  (persisted), and India/US workflow status pills.
- **Workflow control** — India & US cards: active toggle, Run Now, last 5
  executions (color-coded), click a row for full execution JSON.
- **Analytics overview** — Total India leads, Total US leads, emails sent today,
  interested leads.
- **Pipeline funnel** — cumulative `New → Sent → FU1 → FU2 → Replied →
  Interested`, tabbed India/US/Both.
- **Add lead** — collapsible form; appends a row to the correct tab (no workflow
  trigger).
- **Lead table** — search + status/industry filters, sortable, inline **Status**
  dropdown and inline **Notes** edit that write back to the sheet (optimistic UI,
  reverts on failure), 50/page.
- **Daily send volume** — last 30 days, stacked by email type.
- **Interested / Replied tracker** — with a **Mark Interested** action for
  replied leads.
- **Email log** — most recent 100 sends, paginated.
- **Apollo credit efficiency** — reveals attempted vs. revealed + donut.
- Toasts for every write / workflow action, loading skeletons, and error states.

## Tech stack

React + TypeScript + Vite · Recharts · Tailwind CSS · Google Sheets API v4
(service account, read + write) · n8n REST API v1. No app backend (a dev-only
Vite proxy handles n8n CORS).

## Environment variables (`.env`)

Copy `.env.example` to `.env` and fill in the two secrets (the spreadsheet ID,
n8n base URL, and workflow IDs are pre-filled):

```
VITE_SPREADSHEET_ID=1l-Mg8QEw90EfKUMQZgCKmKy2Jr4iX8JH3ur0rnw6MOM
VITE_GOOGLE_SERVICE_ACCOUNT_JSON=<base64 encoded service account JSON>
VITE_N8N_BASE_URL=https://shreyas-sinha.app.n8n.cloud
VITE_N8N_API_KEY=<your n8n API key>
VITE_N8N_INDIA_WORKFLOW_ID=yrYIauoO1q46DORb
VITE_N8N_US_WORKFLOW_ID=41O5a05zrxyWqpe2
```

Optional: `VITE_USE_MOCK_DATA=true` previews the whole UI with sample data (no
credentials, all writes/actions simulated locally).

## Setup

### 1. Google service account (read + write)

1. In the [Google Cloud Console](https://console.cloud.google.com/), pick/create
   a project and enable the **Google Sheets API**.
2. *Credentials → Create Credentials → Service account*. Create it (no project
   roles needed).
3. Open it → **Keys → Add key → Create new key → JSON**. Download the file.
4. Share the spreadsheet with the service account email (the `client_email` in
   the JSON) as **Editor** (Editor is required because the app writes).

### 2. Base64-encode the key

```bash
# Linux
base64 -w0 service-account.json
# macOS
base64 -i service-account.json | tr -d '\n'
```

Paste the single-line output into `VITE_GOOGLE_SERVICE_ACCOUNT_JSON`.

### 3. n8n API key

In n8n: **Settings → n8n API → Create an API key**. Paste it into
`VITE_N8N_API_KEY`. The workflow IDs are in each workflow's URL.

### 4. Run

```bash
npm install
npm run dev      # http://localhost:5181
```

## n8n CORS / proxy

n8n Cloud does not send permissive CORS headers, so a browser on a different
origin cannot call its API directly. This project handles it per environment:

- **Dev** — `vite.config.ts` proxies `/n8n-api/*` → `{VITE_N8N_BASE_URL}/api/v1/*`,
  so browser calls are same-origin.
- **Production** — you need an equivalent **same-origin proxy** (e.g. a
  Cloudflare Worker, Vercel/Netlify Edge Function, or small server) that forwards
  `/api/v1/*` to n8n and injects `X-N8N-API-KEY` server-side. Point the app at it.

## ⚠️ Security (important)

This app talks to Google and n8n **directly from the browser**, so it must embed
the Google service-account **private key** and the **n8n API key** in the client
bundle. Anyone who can load the page can read those secrets.

**Only deploy this to a private / internal, access-gated location.** Do **not**
publish a build that contains real credentials to a public URL. Recommended for
anything beyond a locked-down internal host:

- Put the Sheets calls (`src/lib/sheetsClient.ts`) and n8n calls
  (`src/lib/n8nClient.ts`) behind a small backend/serverless proxy that holds the
  secrets server-side and exposes only the data/actions you need. The client then
  needs no keys at all.

The build published to the PowerhouseTech site at **`/command-center/`** is built
in **sample-data mode** (no secrets) for exactly this reason.

## Deploying on the site (`/command-center`)

```bash
# from the repo root — sample-data mode (safe, no secrets):
scripts/build-outreach-command-center.sh
```

Commit the regenerated `command-center/` folder. `netlify.toml` routes the URL
and `.netlifyignore` keeps the raw source off the CDN. To run against real data,
build on a private host with the real env vars (and a n8n proxy) — see above.

## Row-index tracking (writes)

When leads are fetched, each row keeps its 1-based sheet row number (`_rowIndex`;
header = row 1, first lead = row 2). Inline Status/Notes edits target the exact
cell via `spreadsheets.values.update`; new leads are appended with
`values.append`. After an append the data is refetched so row indices stay
correct.

## Project structure

```
outreach-command-center/
├── src/
│   ├── components/  Sidebar, Header, StatCard, Panel, WorkflowCard,
│   │                ExecutionModal, PipelineFunnel, AddLeadForm, LeadTable,
│   │                DailySendChart, ReplyTracker, EmailLogTable,
│   │                ApolloEfficiency, Toast
│   ├── hooks/       useSheetData, useN8nWorkflows, useTheme
│   ├── lib/         config, sheetsClient, n8nClient, parse, analytics,
│   │                dates, theme, mockData
│   ├── types/       index.ts
│   ├── App.tsx
│   └── main.tsx
├── .env.example
├── package.json
└── README.md
```
