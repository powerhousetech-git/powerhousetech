# PowerhouseTech — Outreach Command Center

The admin control panel for PowerhouseTech's cold email outreach. It **reads and
writes** a Google Sheet and **controls two n8n workflows** (India + US).

It is served on the **main PowerhouseTech site** at **`/command-center`** and
gated by the site's existing **Google admin sign-in** — the same account that used
to reach the old `/admin` console (e.g. `shreyas@powerhousetech.in`). There is
**no separate site and no separate password**:

```
powerhousetech.in  →  sign in (Google)  →  admin  →  /command-center dashboard
```

All Google/n8n secrets live **server-side** in Netlify Functions; the browser
bundle contains no secrets and never calls Google or n8n directly.

## Architecture

```
Browser (React, /command-center)
  │  Authorization: Bearer <Firebase ID token>   (from the site sign-in)
  ├─►  /api/sheets  → netlify/functions/sheets.ts → Google Sheets API
  └─►  /api/n8n     → netlify/functions/n8n.ts    → n8n REST API
                       │
                       └─ each function first verifies the caller is_admin via
                          the site's admin-api ?op=me, then uses the server-only
                          secrets to call Google / n8n.
```

- The React app reuses `window.phAuthGate` (the site's `/js/auth-gate.js`) for
  sign-in state, admin check, and the Firebase ID token.
- Signed-out users are redirected to `/portal?returnTo=/command-center`.
- Non-admins get an "access restricted" screen.

## Features

Workflow control (status, activate/deactivate, **Run Now**, last-5 executions +
JSON modal, 15s polling), analytics KPIs, tabbed pipeline funnel, **Add Lead**
(append), lead table with inline **Status/Notes** writes (optimistic + revert),
daily send volume, Interested/Replied tracker (**Mark Interested**), email log
(recent 100), Apollo efficiency. Dark/light theme, toasts, skeletons, and a
sample-data preview mode.

## Deploy (main Netlify site)

This app is part of the **existing** powerhousetech Netlify site — not a separate
site. The pieces are already in the repo:

- **Functions:** `netlify/functions/{sheets,n8n}.ts` (at the repo root).
- **Routing + runtime:** the repo-root `netlify.toml` declares
  `[functions] directory = "netlify/functions"`, `NODE_VERSION = "20"`, and
  redirects `/api/sheets` + `/api/n8n` to the functions.
- **Frontend:** the built app is committed to `/command-center` (built by
  `scripts/build-outreach-command-center.sh`).

To go live:

1. In the main site's Netlify env vars, add the four **server-side** secrets:
   `GOOGLE_SERVICE_ACCOUNT_JSON` (base64), `N8N_API_KEY`,
   `SPREADSHEET_ID=1l-Mg8QEw90EfKUMQZgCKmKy2Jr4iX8JH3ur0rnw6MOM`,
   `N8N_BASE_URL=https://shreyas-sinha.app.n8n.cloud`.
2. Merge to `main` — Netlify auto-deploys. Sign in on the site as an admin; the
   portal shows a **Command Center** link (and admins are routed there on sign-in).

### Google service account
Enable the Sheets API, create a service account, download a JSON key, share the
spreadsheet with its `client_email` as **Editor**, then base64-encode the key
(`base64 -w0 service-account.json`) into `GOOGLE_SERVICE_ACCOUNT_JSON`.

### n8n API key
n8n → Settings → n8n API → Create an API key → `N8N_API_KEY`.

## Local development

```bash
npm install

# Sample data (no backend / no sign-in needed):
VITE_USE_MOCK_DATA=true npm run dev        # http://localhost:5181

# Real data locally: run the whole site with Netlify CLI from the repo root so
# /js/auth-gate.js and the functions are available, with the secrets in a local
# .env: `netlify dev`.
```

## Client env (`.env`, non-secret)

```
VITE_SPREADSHEET_ID=1l-Mg8QEw90EfKUMQZgCKmKy2Jr4iX8JH3ur0rnw6MOM
VITE_N8N_BASE_URL=https://shreyas-sinha.app.n8n.cloud
VITE_N8N_INDIA_WORKFLOW_ID=yrYIauoO1q46DORb
VITE_N8N_US_WORKFLOW_ID=41O5a05zrxyWqpe2
```

## Security notes

- No secret is prefixed with `VITE_` or bundled into the client.
- The browser only calls `/api/*`; the functions authorize every call via the
  site admin session (`is_admin`) before touching Google/n8n.

## Project structure

```
repo root
├── netlify/functions/  sheets.ts, n8n.ts     (serverless proxy, admin-gated)
├── netlify.toml        (functions dir + /api redirects, on the main site)
├── command-center/     (committed built app, served at /command-center)
└── outreach-command-center/   (source)
    ├── src/
    │   ├── components/ Sidebar, Header, AccessGate, StatCard, Panel,
    │   │               WorkflowCard, ExecutionModal, PipelineFunnel,
    │   │               AddLeadForm, LeadTable, DailySendChart, ReplyTracker,
    │   │               EmailLogTable, ApolloEfficiency, Toast
    │   ├── hooks/      useSheetData, useN8nWorkflows, useTheme
    │   ├── lib/        apiClient, siteAuth, config, sheetsClient, n8nClient,
    │   │               parse, analytics, dates, theme, mockData
    │   ├── App.tsx     (admin gate + dashboard)
    │   └── main.tsx
    └── index.html      (loads Firebase + /js/auth-gate.js)
```
