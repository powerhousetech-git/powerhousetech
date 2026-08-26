# n8n workflow 03 (Sequence Engine) — V3 multi-industry changes

`03_sequence_engine.json` is **not checked into this repo** (n8n workflows live in the
n8n instance itself), so this doc is the spec for whoever edits that workflow in the
n8n UI. It describes what has to change now that outreach is multi-industry
(`/workspace/outreach/industry.html`, `/workspace/portal/src/routes/industries.js`,
`/workspace/supabase/functions/outreach-api/index.ts`).

## Why this matters

Before V3, workflow 03 had two hardcoded tracks (Track A / Track B) with a single
global cadence (`sequence_day1/2/3` → later `cadenceDays[10]`) and the email copy
was written directly into n8n (Set / LLM prompt nodes per track). With industries,
every industry can have:

- its own **email templates** per sequence step (`EmailTemplate` rows — see
  `portal/src/routes/industries.js` `GET/POST /api/industries/:id/templates`,
  `PUT .../templates/:templateId`), each with a `templateType` of `ai` or `static`;
- its own **cadence override** (`IndustryConfig.cadenceDays`, falling back to the
  global `OutreachConfig` row when no override exists — see
  `GET/PUT/DELETE /api/industries/:id/config`);
- its own **historical send data** for reporting (`HistoricalSend`, not relevant to
  n8n, only to `/api/industries/:id/stats`).

`GET /api/contacts/sequence-ready` (Express: `portal/src/routes/contacts.js`,
edge equivalent: `supabase/functions/outreach-api/index.ts`) already does the
per-industry cadence + template resolution server-side, so workflow 03 should
lean on that response instead of re-implementing cadence/track logic in n8n.

## Required changes to workflow 03

### 1. Drop the hardcoded per-track template/LLM nodes

The old flow likely had something like:

```
Track A? → [Set subject/body A] → [LLM node A] → Send
Track B? → [Set subject/body B] → [LLM node B] → Send
```

Replace this with a single branch that reads the per-contact fields already
resolved by `/api/contacts/sequence-ready`:

```jsonc
// one entry inside groups[].contacts[]
{
  "id": "...",
  "name": "...",
  "email": "...",
  "track": "Track B - EMS",
  "industryId": "cly...",
  "templateSubject": "How do you follow up on trade show leads, Jane?",
  "templateBody": "Write a concise cold email ... to Jane (VP Sales at Acme).",
  "templateType": "ai"           // or "static"
}
```

`templateSubject` / `templateBody` are **already placeholder-substituted**
server-side via `renderTemplate()` (`portal/src/lib/outreach.js`): `{{firstName}}`,
`{{lastName}}`, `{{fullName}}`, `{{company}}`, `{{title}}`, `{{country}}` are all
replaced before the contact ever reaches n8n. Do not re-run placeholder
substitution in n8n — the contact object no longer carries raw `{{...}}` template
strings.

### 2. Route on `templateType`, not on `track`

Add an IF / Switch node keyed on `contact.templateType`:

- **`templateType === 'static'`** → skip the AI node entirely. Use
  `templateSubject` as the email subject and `templateBody` as the email body
  verbatim.
- **`templateType === 'ai'`** → feed `templateBody` into the LLM node **as the
  prompt** (it's an instruction like "Write a concise cold email…", not the email
  itself). Use the LLM's output as the email body, and use `templateSubject`
  as the subject line (already substituted, sent as-is — subjects are not run
  through the LLM in the Express reference implementation).
- **`templateType` is `null`/missing** (no template configured for that
  industry + step) → route to a "skip / no template" branch that logs the
  contact and does **not** send or call the mark-sent endpoint. This happens
  when an admin hasn't filled in a template for a step yet
  (`outreach/industry.html` → Templates tab shows "No template configured — n8n
  will skip contacts at this step" for exactly this case).

### 3. Stop resolving cadence in n8n — trust `activeDays` / `cadenceSource`

`GET /api/contacts/sequence-ready` already returns:

```jsonc
{
  "groups": [{ "followUpNum": 1, "dayInSequence": 1, "contacts": [...] }, ...],
  "activeDays": [1, 4, 9],
  "cadenceSource": "industry",  // or "global"
  "totalContacts": 12
}
```

The per-contact cadence resolution (industry override vs. global default,
gap-day cutoff filtering) is done server-side per the `resolveCadence()` /
`prevSentAt()` logic in `portal/src/routes/contacts.js`. Workflow 03 should just
iterate `groups[].contacts[]` — it no longer needs its own copy of the cadence
table or gap-day math. If workflow 03 currently calls `/api/config` directly to
get `cadenceDays`, remove that call.

Optionally pass `?industryId=<id>` or `?track=<A|B>` as a query param on
`sequence-ready` if you want to run the workflow per-industry (e.g. separate
n8n triggers per industry) instead of one global run across all industries.

### 4. Mark-sent callback must include `industryId`

When workflow 03 calls back to mark a contact as sent
(`PATCH /api/contacts/:id` with `{ followUpNum, sentAt, status? }`), it should
also pass `industryId` in the body:

```jsonc
{
  "followUpNum": 2,
  "sentAt": "2026-08-26T10:00:00.000Z",
  "industryId": "cly..."          // contact.industryId from sequence-ready
}
```

`portal/src/routes/contacts.js` already reads `body.industryId` when writing the
`EmailLog` row (`industryId: body.industryId || contact.industryId || null`), so
that this send counts toward the correct industry's stats
(`GET /api/industries/:id/stats`) and toward `GET /api/stats` → `byIndustry`.
Without it, older logs fall back to `contact.industryId`, which is fine for
existing contacts but should be set explicitly going forward.

### 5. Template edits from the new UI take effect immediately

Templates are now edited live from `outreach/industry.html` → Templates tab
(POST `/api/industries/:id/templates` to add a template for a step that
doesn't have one yet, PUT `/api/industries/:id/templates/:templateId` to edit
an existing one). Workflow 03 does not need to be redeployed when copy changes — it
always re-fetches `sequence-ready` per run, which re-joins the latest
`EmailTemplate` row for each `(industryId, followUpNum)` pair via
`templateFor()` in `portal/src/routes/contacts.js`. Only `isActive: false`
templates are excluded (treated the same as "no template").

## Summary of endpoint contracts workflow 03 depends on

| Endpoint | Change |
|---|---|
| `GET /api/contacts/sequence-ready` | Now returns `industryId`, `templateSubject`, `templateBody`, `templateType` per contact, plus top-level `cadenceSource`. Same base shape as before (`groups`/`activeDays`/`totalContacts`), just enriched. |
| `PATCH /api/contacts/:id` | Should now include `industryId` in the mark-sent body so `EmailLog.industryId` is set correctly. |
| `GET /api/config` | No longer needs to be called directly by n8n for cadence — `sequence-ready` already resolves it per contact. |
| `GET/PUT/DELETE /api/industries/:id/config` | Used by the admin UI (Cadence tab), not by n8n directly. |
| `GET/PUT /api/industries/:id/templates`, `PUT /api/industries/:id/templates/:templateId` | Used by the admin UI (Templates tab), not by n8n directly — n8n only ever reads the resolved `templateSubject`/`templateBody`/`templateType` via `sequence-ready`. |
