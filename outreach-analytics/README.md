# PowerhouseTech — Outreach Analytics Dashboard

A standalone analytics dashboard for **PowerhouseTech**'s cold email outreach.
It reads directly from a single Google Spreadsheet (three tabs) and visualizes
the pipeline for two campaigns: **India** and **US**.

> This dashboard is **read-only** and completely separate from the PS2 lead
> management portal and from the n8n workflows. It does not write to the sheet
> and does not touch any n8n automation.

## Features

- **Overview header** — total leads, emails sent today, replies, last-refreshed
  time, manual **Refresh**, and an India / US / Both campaign toggle.
- **Pipeline funnel** — cumulative stages `New → Sent → FU1 → FU2 → Replied →
  Interested` with per-step conversion %.
- **Daily send volume** — last 30 days, stacked by email type (Initial /
  Follow-up 1 / Follow-up 2), including zero-send days.
- **Industry breakdown** — top 10 industries, stacked by status.
- **Replies & interest** — sortable table of `Replied` / `Interested` leads.
- **Apollo credit efficiency** — reveals attempted vs. emails revealed, with a
  donut chart.
- **Email log** — paginated table of the 50 most recent sends, newest first.
- Dark theme, responsive layout (desktop + tablet), loading skeletons, and a
  clear error state when Sheets can't be reached.

## Tech stack

- React + TypeScript + Vite
- Recharts (charts)
- Tailwind CSS (styling)
- Google Sheets API v4, authenticated with a **service account** (read-only)

No backend server is required — the app talks to the Sheets API directly from
the browser.

## Expected Google Sheet structure

One spreadsheet with three tabs (exact, case-sensitive names by default; the tab
names can be overridden via env vars):

### `India Leads`

`Company_Name`, `Industry`, `City`, `Contact_Name`, `Email`, `Title`, `Status`,
`Sent_Date`, `FU1_Date`, `FU2_Date`, `Apollo_Person_ID`, `Notes`

`Status` is one of: `New`, `Sent`, `FU1_Sent`, `FU2_Sent`, `Replied`,
`Interested`, `Not Interested`, `Unsubscribe`.

### `US Leads`

Same columns as `India Leads`, plus a `State` column.

### `Email Log`

`Timestamp`, `Campaign` (`India` / `US`), `Company_Name`, `Contact_Name`,
`Email`, `Email_Type` (`Initial` / `Follow-up 1` / `Follow-up 2`), `Subject`,
`Status` (`Sent` / `Failed`).

> Columns are matched **by header name**, not position, so reordering columns in
> the sheet is safe.

## Setup

### 1. Create a Google Service Account

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and
   create (or pick) a project.
2. Enable the **Google Sheets API**: *APIs & Services → Library → Google Sheets
   API → Enable*.
3. Create a service account: *APIs & Services → Credentials → Create
   Credentials → Service account*. Give it a name (e.g. `outreach-dashboard`)
   and create it. No project roles are required (it only needs sheet-level
   access).
4. Open the new service account → **Keys** → *Add key → Create new key → JSON*.
   A `.json` key file downloads. Keep it safe.

### 2. Share the sheet with the service account

1. Copy the service account's email (looks like
   `outreach-dashboard@your-project.iam.gserviceaccount.com`).
2. Open the spreadsheet → **Share** → paste that email → give it **Viewer**
   access → Send.

### 3. Base64-encode the JSON key

```bash
# Linux
base64 -w0 service-account.json

# macOS
base64 -i service-account.json | tr -d '\n'
```

Copy the single-line output.

### 4. Configure `.env`

```bash
cp .env.example .env
```

Then edit `.env`:

```
VITE_SPREADSHEET_ID=1AbC...the_long_id_from_the_sheet_url
VITE_GOOGLE_SERVICE_ACCOUNT_JSON=eyJ0eXic...the_base64_blob
```

The spreadsheet ID is the part of the URL between `/d/` and `/edit`:
`https://docs.google.com/spreadsheets/d/`**`<SPREADSHEET_ID>`**`/edit`.

Optional overrides if your tabs are named differently:

```
VITE_SHEET_INDIA=India Leads
VITE_SHEET_US=US Leads
VITE_SHEET_EMAIL_LOG=Email Log
```

### 5. Run locally

```bash
npm install
npm run dev
```

Open the URL Vite prints (default http://localhost:5180).

### Build for production

```bash
npm run build
npm run preview
```

## Deploying on the PowerhouseTech site (`/outreach-dashboard`)

This app is published as committed static assets on the main Netlify site, served
at **`/outreach-dashboard/`** (source stays in `outreach-analytics/`, built output
is committed to `outreach-dashboard/` at the repo root — mirroring the medspa
dashboard convention). A helper script does the build + publish:

```bash
# from the repo root — builds in SAMPLE-DATA mode (safe, no secrets):
scripts/build-outreach-analytics.sh
```

Then commit the regenerated `outreach-dashboard/` folder. Netlify redirects for
the route live in `netlify.toml`, and the raw source folder is excluded from the
CDN upload via `.netlifyignore`.

> **Why sample-data mode for the committed build?** Vite inlines `VITE_*` env
> vars at build time. Committing a build made with a real
> `VITE_GOOGLE_SERVICE_ACCOUNT_JSON` would publish the service-account **private
> key** into a public static bundle — a credential leak. So the committed public
> build uses the built-in sample dataset and shows a "Sample data" badge.

### Going live with real data (securely)

Because the key must never be shipped to the browser on a public site, use one of:

- **Private host / access-gated deploy** — build with real env vars on an
  internal host that is not publicly reachable:

  ```bash
  VITE_USE_MOCK_DATA=false \
  VITE_SPREADSHEET_ID=... \
  VITE_GOOGLE_SERVICE_ACCOUNT_JSON=... \
  scripts/build-outreach-analytics.sh
  ```

- **Backend proxy (recommended for public)** — move the fetch in
  `src/lib/sheetsClient.ts` into a small serverless function that holds the key
  server-side and returns only data; point the frontend at that endpoint.

## ⚠️ Security note (please read)

This app signs a Google JWT **in the browser** using the service account's
private key, which means the key is bundled into the client and is readable by
anyone who can load the page. That is acceptable only for a **private / internal,
access-gated deployment** using a dedicated **read-only** service account that
has access to nothing but this one spreadsheet.

If you ever need to expose this dashboard publicly, move the Sheets fetch behind
a tiny backend proxy (or a serverless function) that holds the key server-side
and returns only the data. The `src/lib/sheetsClient.ts` fetch logic can be
lifted into such a proxy with minimal changes.

## Implementation notes

- **Auth**: The task specified `google-auth-library`, which is a Node package and
  does not run reliably in a browser bundle. This project implements the exact
  same OAuth2 *JWT-bearer* flow using the browser-native **WebCrypto** API
  (RS256), so it works client-side with no Node polyfills. See
  `src/lib/sheetsClient.ts`.
- **Funnel** counts are cumulative (a `Replied` lead also counts toward `Sent`,
  `FU1_Sent`, etc.).
- **Dates** are parsed defensively; empty or invalid values are ignored.
- **Daily volume** only counts sends with `Status !== Failed`.

## Project structure

```
outreach-analytics/
├── src/
│   ├── components/
│   │   ├── Sidebar.tsx
│   │   ├── Panel.tsx
│   │   ├── StatCard.tsx
│   │   ├── PipelineFunnel.tsx
│   │   ├── DailySendChart.tsx
│   │   ├── IndustryBreakdown.tsx
│   │   ├── ReplyTable.tsx
│   │   ├── ApolloEfficiency.tsx
│   │   └── EmailLogTable.tsx
│   ├── hooks/
│   │   └── useSheetData.ts     ← fetches + parses all three sheets
│   ├── lib/
│   │   ├── sheetsClient.ts     ← Google Sheets API auth + fetch
│   │   ├── parse.ts            ← raw rows → typed records
│   │   ├── analytics.ts        ← funnel / daily / industry / Apollo derivations
│   │   ├── dates.ts            ← safe date helpers
│   │   └── theme.ts            ← colors + status badges
│   ├── types/
│   │   └── index.ts            ← Lead, LogEntry, etc.
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── .env.example
├── package.json
└── README.md
```
