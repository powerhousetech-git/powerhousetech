# Cursor → Claude — Outreach Portal Status

**Date:** 2026-10-03  
**From:** Cursor  
**Branch:** `cursor/outreach-portal-v2-d4c3`  
**Re:** Claude note “Outreach Command Center v2 (Portal UI)”

---

## 1. What shipped

Portal UI + Edge Function routing for the v2 sheet / n8n contract.

### New / updated UI
- **Populate Leads** — credit estimate (~1/lead), Confirm modal, then POST Apollo Discovery via proxy → webhook `run-apollo-discovery` with `{ per_page, location, titles?, keywords? }`.
- **Pending Approvals** — all `Status=Pending` rows; Approve / Reject (per-row + bulk). Approve writes `In_Sequence` + `Sequence_Step=0` + `Next_Send_Date=''`. Reject → `Rejected` (kept for audit).
- **Settings panel** — read/write `India_Daily_Cap`, `US_Daily_Cap`, `FU_Interval_Days`, `Max_Sequence_Steps` on the **Settings** sheet tab (Key|Value). Caps also shown on Overview.
- **Sequence progress** — step bar + next-send in Lead Table.
- **Run Now confirm** — India/US cards confirm before firing `run-india-outreach-v2` / `run-us-outreach-v2`.
- Workflow IDs default to Claude’s v2: India `c2JyDKolZaIhUlzs`, US `fHFG8B2mhToK6bid`, Apollo `lMK8RlkBJS4V8aAH`.

### Key files
| Area | Path |
|---|---|
| Types / parse / settings | `outreach-command-center/src/types/index.ts`, `lib/parse.ts`, `lib/sheetsClient.ts` |
| Config / n8n client | `lib/config.ts`, `lib/n8nClient.ts`, `hooks/useN8nWorkflows.ts`, `hooks/useSheetData.ts` |
| UI | `components/PopulateLeads.tsx`, `PendingApprovals.tsx`, `SequenceBar.tsx`, `ConfirmModal.tsx`, `LeadTable.tsx`, `WorkflowCard.tsx`, `App.tsx`, `Sidebar.tsx` |
| Edge proxy | `supabase/functions/command-center/n8n-run.ts`, `index.ts` — default webhook map + pass-through body extras |
| Built SPA | `command-center/` (rebuild via `scripts/build-outreach-command-center.sh`) |

---

## 2. Decisions that differ from the note

1. **Webhooks go through the Edge Function**, not the browser. Same admin Firebase gate as other Command Center calls. Body still matches your webhook contract; paths are hardcoded as defaults (`DEFAULT_WEBHOOK_PATHS`) and overridable with `CC_N8N_WEBHOOKS`.
2. **Credit preview** is a fixed estimate (`~1 credit × per_page`), not a live Apollo balance API (none exposed).
3. **Settings tab** assumed **Key | Value** columns. Also accepts a wide header row with the four keys. If your Sheet Setup wrote a different layout, tell Cursor the exact headers.
4. **Approve leaves `Next_Send_Date` empty** exactly as specified (“due now”). Portal does not pre-fill next weekday.
5. **Legacy columns** (`Notes`, `Sent_Date`, `FU*_Date`, `Apollo_Person_ID`) still parse if present; appends use the v2 column set only. Notes inline-edit is removed from the lead table (column may not exist).
6. **Apollo discovery** is India *or* US via the same webhook (`location: "India" | "United States"`). Titles default to MD/CEO/Founder/VP Ops/Head of Ops unless Claude wants different defaults.
7. Did **not** delete Rejected rows.

---

## 3. Blocked / need from Claude

| Item | Need |
|---|---|
| Confirm Settings sheet layout | Key\|Value vs single-row wide headers — portal supports both; confirm which Sheet Setup wrote. |
| Schedule trigger node names | Portal defaults are `Daily India Outreach` / `Daily US Outreach` (only used as fallback if webhook override fails). Share exact Schedule node names if different. |
| Apollo workflow Active? | `lMK8RlkBJS4V8aAH` must stay **Active** or production webhook 404s. |
| Live credit balance (optional) | If you expose a balance node/endpoint later, portal can show real remaining credits instead of ~1/lead. |
| Edge Function deploy | After merge, redeploy `command-center` so `DEFAULT_WEBHOOK_PATHS` + body extras are live (or set `CC_N8N_WEBHOOKS` JSON on the function). |

---

## 4. Quick verify checklist (human)

1. Open `/command-center` as admin.
2. Settings shows 30/30/3/10 (or sheet values); edit + Save → sheet updates.
3. Populate Leads → Confirm → toast “Discovery running…” → Pending rows appear after Apollo finishes.
4. Approve one Pending → Status `In_Sequence`, step `0`, next send empty.
5. Run India Now / Run US Now → confirm modal → webhook accepted; executions list updates.

