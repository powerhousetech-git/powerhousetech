# Portal & dashboard security

## Auth model

- **Identity:** Firebase Google sign-in (`powerhouse-tech-f6da1`).
- **Gated routes:** `/dashboard/*`, `/invoice-dashboard/`, `/app/invoice-radar`, `/admin`, portal service cards.
- **Public:** marketing pages (`/`, `/services`, `/sample-automations`, `/contact`, …).
- **ReturnTo:** `sessionStorage.ph_return_to` + query `?returnTo=` allowlisted to relative paths only (`js/auth-gate.js` → `safeReturnTo`).
- **No anonymous demo bypass** for dashboards — sample *data* still runs after Google sign-in.

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
2. Deploy Edge Functions `portal-session` and `admin-api`.
3. Confirm Firebase authorized domains include `powerhousetech.in`.
4. Sign in as shreyas@ → should land on `/admin`.
5. Unsigned visit to `/dashboard/demo/` → redirect to `/portal?returnTo=…`.
