# PowerhouseTech — Outreach Command Center

A password-protected control panel for PowerhouseTech's cold email outreach. It
**reads and writes** a Google Sheet and **controls two n8n workflows** (India +
US) — status, activate/deactivate, manual "Run Now", and recent executions.

All Google/n8n secrets live **server-side** in serverless functions (`/api/*`);
the browser bundle contains **no secrets** and never calls Google or n8n
directly. Access is gated by a single shared password.

> Separate from the PS2 lead-management portal, the Sahasra/Harshul dashboards,
> and the read-only `/outreach-dashboard`. It does **not** modify n8n workflow
> logic — only triggers runs and toggles active state. The old `/admin` console
> has been removed; this is the admin's post-sign-in destination.

## Architecture

```
Browser (React)  ──►  /api/auth    ──►  checks APP_PASSWORD
                 ──►  /api/sheets  ──►  Google Sheets API (service account)
                 ──►  /api/n8n     ──►  n8n REST API (X-N8N-API-KEY)
```

- The client stores the password in `sessionStorage` and sends it as the
  `x-app-token` header on every `/api/*` request.
- The serverless functions validate that header against `APP_PASSWORD`, then use
  the server-only secrets to call Google / n8n and forward the response.

## Features

- **Login screen** — single shared password (no username), `sessionStorage`
  session, **Sign out** in the header. Wrong password shows an inline error.
- **Workflow control** — India & US cards: status pills, activate/deactivate,
  **Run Now** (toast "Execution started: {id}"), last-5 executions, click a row
  for full execution JSON. Polls every 15s while a run is `running`.
- **Analytics overview**, **pipeline funnel** (tabbed), **Add lead** (append),
  **lead table** with inline Status/Notes writes (optimistic + revert-on-error),
  **daily send volume**, **Interested/Replied tracker** (Mark Interested),
  **email log** (recent 100), **Apollo efficiency**.
- Dark/light theme toggle (persisted), toasts, loading skeletons, error states,
  and a **sample-data preview mode**.

## Tech stack

React + TypeScript + Vite · Recharts · Tailwind CSS · Vercel serverless
functions (`@vercel/node`, `google-auth-library`) for the proxy.

## Environment variables

The two groups are kept strictly separate.

### Server-side (Vercel → Settings → Environment Variables) — SECRET

| Var | Value |
|-----|-------|
| `APP_PASSWORD` | any strong shared password (e.g. `pht-internal-2026`) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | base64 of the service-account JSON (Editor on the sheet) |
| `N8N_API_KEY` | your n8n API key |
| `SPREADSHEET_ID` | `1l-Mg8QEw90EfKUMQZgCKmKy2Jr4iX8JH3ur0rnw6MOM` |
| `N8N_BASE_URL` | `https://shreyas-sinha.app.n8n.cloud` |

### Client-side (`.env`, safe/non-secret)

```
VITE_SPREADSHEET_ID=1l-Mg8QEw90EfKUMQZgCKmKy2Jr4iX8JH3ur0rnw6MOM
VITE_N8N_BASE_URL=https://shreyas-sinha.app.n8n.cloud
VITE_N8N_INDIA_WORKFLOW_ID=yrYIauoO1q46DORb
VITE_N8N_US_WORKFLOW_ID=41O5a05zrxyWqpe2
# VITE_USE_MOCK_DATA=true   # optional: sample-data preview, skips login + network
```

## Setup

1. **Google service account (read + write).** In Google Cloud, enable the Sheets
   API, create a service account, download a JSON key, and share the spreadsheet
   with its `client_email` as **Editor**. Base64-encode the key:
   `base64 -w0 service-account.json` (macOS: `base64 -i … | tr -d '\n'`).
2. **n8n API key.** n8n → Settings → n8n API → Create an API key.
3. Put the secrets in Vercel (see table). Copy `.env.example` to `.env` for the
   client vars.

### Run locally

```bash
npm install

# Sample data (no backend/secrets needed):
VITE_USE_MOCK_DATA=true npm run dev          # http://localhost:5181

# Real data (runs the /api functions locally via Vercel):
npm i -g vercel
vercel dev                                    # put the SECRET env vars in .env for this
```

## Deploy to Vercel (primary)

```bash
npm i -g vercel
vercel            # project: powerhousetech-command-center, framework: Vite,
                  # build: npm run build, output: dist
```

Then add the **server-side** env vars in the Vercel dashboard and redeploy:

```bash
vercel --prod
```

Live at `powerhousetech-command-center.vercel.app` (add a custom domain such as
`dashboard.powerhousetech.in` in Vercel → Domains). `vercel.json` is included
(Vite framework, SPA rewrite, `/api/*` preserved).

> This is the correct place to run against **real data**: secrets stay in
> Vercel's env, the browser never sees them.

## Sample preview on the PowerhouseTech site (`/command-center`)

A **sample-data** build (no secrets, login bypassed) is committed to the repo and
served by Netlify at `/command-center` for previewing the UI. Rebuild it with:

```bash
scripts/build-outreach-command-center.sh    # from repo root; base=/command-center/, mock
```

This build has no `/api` backend and never touches real data — it exists only so
the UI can be seen without the Vercel/secret setup.

## Security notes

- **No secret is ever prefixed with `VITE_`** or bundled into the client.
- The browser never calls Google or n8n directly — only `/api/*`.
- The single-password gate is intentionally simple (internal tool). For stronger
  auth, put the app behind your identity provider / SSO in front of Vercel.

## Row-index tracking (writes)

Each fetched lead keeps its 1-based sheet row number (`_rowIndex`; header = row
1). Inline Status/Notes edits target the exact cell via `values.update`; new
leads use `values.append`, after which data is refetched so indices stay correct.

## Project structure

```
outreach-command-center/
├── api/            sheets.ts, n8n.ts, auth.ts   (Vercel serverless proxy)
├── src/
│   ├── components/ Sidebar, Header, LoginScreen, StatCard, Panel, WorkflowCard,
│   │               ExecutionModal, PipelineFunnel, AddLeadForm, LeadTable,
│   │               DailySendChart, ReplyTracker, EmailLogTable, ApolloEfficiency,
│   │               Toast
│   ├── hooks/      useSheetData, useN8nWorkflows, useTheme
│   ├── lib/        apiClient, config, sheetsClient, n8nClient, parse, analytics,
│   │               dates, theme, mockData
│   ├── types/      index.ts
│   ├── App.tsx     (auth gate + dashboard)
│   └── main.tsx
├── vercel.json
├── .env.example
└── README.md
```
