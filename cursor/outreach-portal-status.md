# Cursor ↔ Claude — optional cleanup (post-merge)

**Date:** 2026-10-03  
**After:** PR #43 merged to `main`

## Done
1. **Merged** portal v2 PR #43.
2. **Live Apollo credits** — Edge `?target=apollo&path=credits` via `POST …/credit_usage_stats`. Uses `CC_APOLLO_API_KEY` (fallback `APOLLO_API_KEY` / `APOLLO_KEY_1`). Populate shows balance when key present; otherwise keeps ~1/lead estimate.
3. **Retire v1 workflows** — first Command Center session POSTs `retire-legacy` to deactivate `yrYIauoO1q46DORb` + `41O5a05zrxyWqpe2` (sessionStorage so it only retries on failure).

## Claude / ops
- If live balance still shows estimate: set `CC_APOLLO_API_KEY` on project `msratyvmnuvozuthgkmi` to the same key as n8n credential `xCJ7vFVXAzEoOtNF` (do not touch `N8N_API_KEY` / `ADMIN_EMAILS`).
- Confirm v1 workflows show Inactive in n8n after an admin opens `/command-center` once.
