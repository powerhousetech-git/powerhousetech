# Portal & dashboard security

## Auth model

- **Identity:** Firebase Google sign-in (`powerhouse-tech-f6da1`).
- **Gated routes:** `/app/invoice-radar`, `/admin` (live client / admin).
- **Public sample demos:** `/dashboard/demo/`, `/invoice-dashboard/`, marketing pages (`/`, `/services`, `/sample-automations`, `/contact`, …).
- **ReturnTo:** `sessionStorage.ph_return_to` + query `?returnTo=` allowlisted to relative paths only (`js/auth-gate.js` → `safeReturnTo`).
- Sample demos use mock data and load without Google sign-in so marketing visitors never hit a blank auth wall.

## Admin

- Role flag `portal_users.is_admin` in Supabase (seeded: `shreyas@powerhousetech.in`).
- `/admin` uses same Google login; `admin-api` verifies Firebase JWT then `is_admin`.
- Client never trusts a local admin flag alone.
- Invoice Radar `client_key` never returned to browsers (entitlement APIs redact it).

## Server rules

- Tables `portal_users`, `portal_events`, entitlements, credits: **RLS on, no anon policies** — Edge Functions use service role after Firebase verify.
- Functions: `portal-session`, `admin-api`, existing `invoice-radar-proxy`, `user-credits`.

## Operational checklist

1. Apply migration `20260810120000_portal_users_events.sql`.
2. Deploy Edge Functions `portal-session` and `admin-api` (`verify_jwt: false` — they verify Firebase ID tokens themselves).
3. Confirm Firebase authorized domains include `powerhousetech.in`.
4. Sign in as shreyas@ → should land on `/admin`.
5. Public sample demos (`/dashboard/demo/`, `/invoice-dashboard/`) load without sign-in; live `/app/invoice-radar` stays gated.
6. `/sample-automations` embeds those public demos (no Loom placeholders).

## Deploy without `SUPABASE_ACCESS_TOKEN`

Cloud/agent environments often lack a CLI personal access token. Prefer **Supabase MCP** (authenticated in Cursor) instead of `scripts/deploy-functions.sh`:

- `apply_migration` — run SQL migrations (e.g. `portal_users_events`)
- `deploy_edge_function` — ship `portal-session` / `admin-api` with relative `_shared/*` files and `verify_jwt: false`
- `list_edge_functions` / `execute_sql` — verify deploy + seed (`shreyas@powerhousetech.in` is admin)

CLI remains optional: create a token at https://supabase.com/dashboard/account/tokens, then `export SUPABASE_ACCESS_TOKEN=sbp_...` and run `./scripts/deploy-functions.sh`.
