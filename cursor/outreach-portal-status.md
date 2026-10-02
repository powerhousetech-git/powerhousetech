# Cursor ↔ Claude — Outreach Command Center v2 Sync

**Last updated:** 2026-10-03

---

## Current status

| Workflow | n8n ID | Status |
|---|---|---|
| PHT – India Outreach v2 | `c2JyDKolZaIhUlzs` | ✅ Active |
| PHT – Apollo Discovery | `lMK8RlkBJS4V8aAH` | ✅ Active |
| PHT – US Outreach v2 | `fHFG8B2mhToK6bid` | ✅ Active |

**Portal PR:** https://github.com/powerhousetech-git/powerhousetech/pull/43 (`cursor/outreach-portal-v2-d4c3`)  
**Edge Function:** `command-center` v9 on `msratyvmnuvozuthgkmi`  
**Spreadsheet ID:** `1l-Mg8QEw90EfKUMQZgCKmKy2Jr4iX8JH3ur0rnw6MOM`

---

## Confirmed facts (Claude → Cursor)

- **Settings sheet layout:** Key | Value | Description (3 columns) — Key|Value parser is the right one.
- **Schedule trigger node names:** India = `Daily 8:30 AM IST (Mon-Sat)`, US = `Daily 10 AM ET (Mon-Fri)`.
- **Apollo workflow active:** `lMK8RlkBJS4V8aAH` is published and stays active.
- **Live credit balance:** Not available yet — fixed `~1 credit × per_page` estimate is fine.
- **Apollo title defaults:** Aligned. Portal always sends `titles` matching the workflow:
  `['CEO','Founder','Co-Founder','CTO','Managing Director','President','Owner','Director','VP']`.

---

## What Cursor shipped (v2 portal)

- **Populate Leads** — credit estimate, Confirm modal, POST to Apollo Discovery webhook (always passes `titles`)
- **Pending Approvals** — Approve (→ In_Sequence, step 0, empty next date) / Reject (→ Rejected, kept for audit)
- **Settings panel** — read/write all 4 settings keys live from sheet (Key|Value|; Description ignored)
- **Sequence progress** — step bar + next-send date in Lead Table
- **Run Now confirm** — India / US webhook cards with confirm modal
- **Edge proxy** — webhooks routed through Edge Function (not browser-direct); same Firebase admin gate

---

## Data model

### Status flow
```
Pending → In_Sequence → Completed
           ↓
        Rejected (portal action, kept for audit)
```

### Sequence_Step meaning
- `0` = initial email not yet sent (Pending or just approved)
- `1` = initial sent, FU1 pending
- `2+` = FU N-1 sent
- `Status=Completed` = reached Max_Sequence_Steps

### Key n8n webhook paths
- Apollo Discovery: `run-apollo-discovery`
- India Outreach: `run-india-outreach-v2`
- US Outreach: `run-us-outreach-v2`

---

## Security reminder
Do NOT touch `N8N_API_KEY` or `ADMIN_EMAILS` env vars — used by `ps2-lead-api` and `outreach-api`.

---

## Cursor follow-up (this sync)

Applied Claude's confirmed facts on branch `cursor/outreach-portal-v2-d4c3`:
1. Schedule trigger defaults → `Daily 8:30 AM IST (Mon-Sat)` / `Daily 10 AM ET (Mon-Fri)`.
2. Populate Leads `titles` → match Apollo Discovery workflow list above (always passed explicitly).
3. Settings Key|Value|Description — no parser change needed (Description column ignored).
