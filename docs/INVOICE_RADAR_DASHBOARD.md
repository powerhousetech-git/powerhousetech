# Invoice Radar — authenticated dashboard

Gated client dashboard at `/app/invoice-radar` for users with `invoice_radar_enabled = true`.

## Architecture

```
Browser (Firebase session)
  → Bearer ID token
  → Supabase `invoice-radar-proxy`
      → check entitlement (403 + upsell if disabled)
      → GET/POST client's Apps Script web app with server-held `clientKey`
  → Google Sheet data
```

The `clientKey` never reaches the browser.

## Ops setup

### 1. Apply migration

Run [`supabase/migrations/20260710120000_user_service_entitlements.sql`](supabase/migrations/20260710120000_user_service_entitlements.sql) on project `msratyvmnuvozuthgkmi`.

### 2. Deploy Edge Function

```bash
export SUPABASE_ACCESS_TOKEN="sbp_..."
npm run deploy:functions
```

Deploys `invoice-radar-proxy` (see [`scripts/deploy-functions.sh`](scripts/deploy-functions.sh)).

### 3. Seed an entitled user

```sql
insert into public.user_service_entitlements (
  email,
  invoice_radar_enabled,
  invoice_radar_web_app_url,
  invoice_radar_client_key
) values (
  'client@example.com',
  true,
  'https://script.google.com/macros/s/DEPLOYMENT_ID/exec',
  'your-long-random-portal-key'
)
on conflict (email) do update set
  invoice_radar_enabled = excluded.invoice_radar_enabled,
  invoice_radar_web_app_url = excluded.invoice_radar_web_app_url,
  invoice_radar_client_key = excluded.invoice_radar_client_key,
  updated_at = now();
```

### 4. Configure Apps Script (per client)

In the client's Invoice Radar engine project:

1. Set Script property `PORTAL_CLIENT_KEY` to the same value as `invoice_radar_client_key` in Supabase.
2. Include [`11_PortalApi.gs`](../invoice%20automation/invoice-radar-engine/11_PortalApi.gs) and updated [`09_WebApp.gs`](../invoice%20automation/invoice-radar-engine/09_WebApp.gs).
3. Redeploy the web app (execute as owner, access **Anyone**).

Portal API:

- `GET ?action=snapshot&key=…` → JSON snapshot
- `POST` JSON `{ action, key, id, … }` → approve, snooze, skip, setChannel, markPaid, confirmReview, approveAll

Pay links (`?pay=`) are unchanged.

## Access behaviour

| User | Nav | Direct URL | API |
|------|-----|------------|-----|
| Not signed in | Hidden | Sign-in gate | 401 |
| Signed in, not entitled | Hidden | Upsell page | 403 |
| Entitled | Invoice Radar link in workspace | Live dashboard | 200 |

## Smoke test

1. Open `/app/invoice-radar` unsigned → sign-in prompt.
2. Sign in without entitlement row → upsell with Book a call.
3. Seed entitlement + GAS key → nav link appears in workspace; dashboard loads KPIs.
4. Approve a reminder → POST proxy → sheet updates → refresh shows new counts.

## Files

| File | Role |
|------|------|
| [`app/invoice-radar.html`](app/invoice-radar.html) | Dashboard shell |
| [`css/invoice-radar-app.css`](css/invoice-radar-app.css) | Light theme UI |
| [`js/invoice-radar-app.js`](js/invoice-radar-app.js) | Views + proxy client |
| [`supabase/functions/invoice-radar-proxy/`](../supabase/functions/invoice-radar-proxy/) | Auth + entitlement + GAS proxy |
| [`index.html`](index.html) | Workspace nav gate |
