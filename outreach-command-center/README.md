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

All Google/n8n secrets live **server-side** in a Supabase Edge Function (the same
platform as the site's other backends, e.g. `admin-api`, `outreach-api`); the
browser bundle contains no secrets and never calls Google or n8n directly.

## Architecture

```
Browser (React, /command-center)
  │  Authorization: Bearer <Firebase ID token>   (from the site sign-in)
  └─►  Supabase Edge Function  supabase/functions/command-center
         ?target=sheets → Google Sheets API (service account)
         ?target=n8n    → n8n REST API (X-N8N-API-KEY)
         │
         └─ verifies the Firebase token + that the email is an admin
            (ADMIN_EMAILS), then uses server-only secrets to call Google / n8n.
```

> Why Supabase and not Netlify Functions: the main powerhousetech Netlify site is
> a pre-built multi-app static site, and enabling Netlify Functions on it broke
> its deploy. This project already runs its secret-holding backends as Supabase
> Edge Functions, so the Command Center proxy lives there too — the SPA still
> ships on the main site at `/command-center`, unchanged.

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

## Deploy

Two independent pieces:

**A. Frontend (main Netlify site).** The built app is committed to `/command-center`
and served by the existing powerhousetech Netlify site — no Netlify build/functions
changes. Rebuild with `scripts/build-outreach-command-center.sh` and merge; Netlify
auto-deploys. Sign in as an admin and the portal shows a **Command Center** link
(admins are routed there on sign-in).

**B. Backend (Supabase Edge Function).** Deploy the proxy and set its secrets:

```bash
supabase functions deploy command-center            # from repo root
supabase secrets set \
  GOOGLE_SERVICE_ACCOUNT_JSON="$(base64 -w0 service-account.json)" \
  SPREADSHEET_ID=1l-Mg8QEw90EfKUMQZgCKmKy2Jr4iX8JH3ur0rnw6MOM \
  N8N_BASE_URL=https://shreyas-sinha.app.n8n.cloud \
  N8N_API_KEY=your_n8n_api_key \
  ADMIN_EMAILS=shreyas@powerhousetech.in,yash@powerhousetech.in
```

`verify_jwt = false` is already set for this function in `supabase/config.toml`
(it does its own Firebase-admin verification). `ADMIN_EMAILS` is a comma-separated
allowlist of who may use the dashboard; it defaults to
`shreyas@powerhousetech.in,yash@powerhousetech.in` and is overridable via the
secret above.

### Custom domain (`dashboard.powerhousetech.in`)
Add `dashboard.powerhousetech.in` as a **domain alias** for the main Netlify site
(DNS CNAME → Netlify, then add it under Domain management). It serves the same
site, so the Command Center is reachable at
`https://dashboard.powerhousetech.in/command-center/`.

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

# Real data locally: serve the Supabase function (`supabase functions serve
# command-center --no-verify-jwt` with the secrets in supabase/.env) and set
# VITE_COMMAND_CENTER_API to its local URL.
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
- The browser only calls the Supabase `command-center` function with the admin's
  Firebase token; the function verifies the admin before touching Google/n8n.

## Project structure

```
repo root
├── supabase/functions/command-center/index.ts   (serverless proxy, admin-gated)
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
