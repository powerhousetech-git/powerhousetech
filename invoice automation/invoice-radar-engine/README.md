# Invoice Radar — Engine

The real, deployable engine behind the Invoice Radar prototype: a Google Apps Script project bound to a client's Google Sheet, using Claude for extraction and WhatsApp/email for reminders. It follows the same "conveyor-belt" Stage pattern as OutboundEngine — every invoice has a stage and advances one step at a time.

This is a working backend, not a mock. Every flow below is covered by an automated test harness (`tests/run.js`) that runs the whole engine against an in-memory Sheet with Claude and WhatsApp mocked — **63 assertions, all green**.

## What each file does

| File | Responsibility |
|------|----------------|
| `appsscript.json` | Manifest — OAuth scopes (read-only Gmail, external requests, send mail) + web-app config |
| `00_Config.gs` | Tuning (stage thresholds, cap, channels), tab/column schema, secret accessors |
| `01_Sheet.gs` | The only place that touches the spreadsheet — read/append/write/delete helpers + audit log |
| `02_Util.gs` | Pure date math, ₹ formatting, pay-link builder, testable clock |
| `03_Messages.gs` | WhatsApp + email reminder drafts (friendly / firm / final) |
| `04_Engine.gs` | The state machine — `stageOf_`, `decideReminder_` (pure) + `runEngine_` driver |
| `05_Extract.gs` | Claude vision/text extraction + confidence parsing + AR/AP/Review routing (pure core) |
| `06_Capture.gs` | The three doors: Gmail scan, Drive photos, manual; `routeCapture_`, `confirmReview_` |
| `07_Send.gs` | WhatsApp Business API + email, with graceful WA→email fallback |
| `08_Approvals.gs` | Approval gate, snooze/skip, reconciliation (`markPaid_`), rollover at the cap |
| `09_WebApp.gs` | The payment-link web app (`doGet`) — hitting the link marks paid & stops the chase |
| `10_Setup.gs` | `initialize()`, custom menu, time-driven triggers |
| `tests/` | Fake GAS runtime + the end-to-end harness |

## How the engine decides (the ladder)

Days overdue = today − due date.

| Stage | When | Action |
|-------|------|--------|
| 0 Not started | not yet due | nothing |
| 1 Reminder 1 · friendly | 1–7 days | **auto-sends** |
| 2 Reminder 2 · firm | 8–20 days | **waits for approval** |
| 3 Final notice | 21+ days | **waits for approval** |

Firm/final reminders land in the Approvals gate. The operator verifies, edits the wording, switches channel, snoozes, or skips — nothing firm sends until `Approval = Approved`, at which point the next engine run sends it. Paying via the link (or a manual "Mark paid") flips the invoice to Paid and the engine stops chasing.

## Deploy (per client)

1. Create a Google Sheet in the client's account → Extensions → Apps Script.
2. Add each `.gs` file (and set the manifest from `appsscript.json`).
3. In **Project Settings → Script properties**, set:
   - `ANTHROPIC_API_KEY`
   - `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` (WhatsApp Business API)
   - optional `DRIVE_INBOX_FOLDER_ID` (photo drop folder), `MASTER_SHEET_ID` (if unbound)
4. Run `initialize()` once — builds every tab with headers.
5. Run `installTriggers()` — daily chase run + inbox scan every 2 hours.
6. Deploy → **New deployment → Web app** (execute as you, access "Anyone"). The deployment URL is the base for payment links; set `PAY_BASE` in `00_Config.gs` to your branded domain that forwards to it.
7. In Gmail, apply the label `invoices-inbox` (or your own — see `GMAIL_QUERY`) to incoming invoices, or share a Drive folder for photos.

**Security note:** secrets live only in Script Properties — never in code. Gmail scope is **read-only**; the engine cannot send or delete mail from the inbox it scans.

## Run the tests

```
node tests/run.js
```

The harness (`tests/gas-stubs.js`) fakes SpreadsheetApp/Gmail/UrlFetch/MailApp with an in-memory sheet, mocks Claude's JSON output and the WhatsApp endpoint (including a forced-failure mode to exercise the email fallback), and drives every flow: setup, capture routing (high-conf → AR, low-conf → Review, payable → AP, malformed → safe fail), review confirmation, the stage machine, KPI parity with the prototype (₹13,360 outstanding / ₹11,350 overdue / 3 invoices), auto-vs-gated sending, approvals, snooze, channel switching, WA→email fallback, disputes, pay-link reconciliation, and rollover at the cap.

## What's mocked vs. real

Real: all engine logic, the sheet schema, the state machine, message drafting, routing, reconciliation, rollover, the web-app endpoint. Mocked **only in tests**: the Claude API response and the WhatsApp/email transport (so tests run offline and deterministically). In production those call the live Anthropic and WhatsApp Business APIs via `UrlFetchApp`.

## Not auto-wired (by design)

SMS: India requires DLT registration, so SMS is a per-client opt-in fallback rather than a default channel. The Zoho/Tally two-way sync is stubbed as `pushPaidToBooks_` / `syncPaidToZoho_` — implement per client in an `11_Integrations.gs`.
