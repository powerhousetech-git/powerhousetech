# Cowork ↔ Cursor handoff — Outreach portal + n8n

> For Claude Cowork / the n8n workspace. Do not rebuild the portal.

## Paste this into n8n workflows (find-replace + re-import)

```
PORTAL_BASE_URL=https://msratyvmnuvozuthgkmi.supabase.co/functions/v1/outreach-api
PORTAL_API_KEY=2e5559ab3d6c6c520534ad11841227924392e7a6d97f9bfb
```

1. Find-replace any `trycloudflare.com` or `localhost:3000` base → `PORTAL_BASE_URL` above.
2. Ensure every portal HTTP node has:

```
Authorization: Bearer 2e5559ab3d6c6c520534ad11841227924392e7a6d97f9bfb
```

3. Re-import the four workflow JSONs.

Admin dashboard (Google as `shreyas@powerhousetech.in`): https://powerhousetech.in/outreach/

**Controls** (manual n8n triggers): https://powerhousetech.in/outreach/controls  
Requires workflows 01 & 03 **active** with webhook paths `outreach-discover` and `outreach-mail`.

Full endpoint list: `n8n/PRODUCTION.md`.

## You still do in n8n (manual)

1. **Gmail OAuth2** → Settings → Credentials → assign to workflows **03 & 04**
2. **Anthropic key** → HTTP Header Auth, header `x-api-key` → assign to workflow **03**

## Two different “logins” — do not confuse them

| Who | How they auth | Used for |
|---|---|---|
| **Shreyas (human)** | Google sign-in as `shreyas@powerhousetech.in` | Dashboard at `/outreach/` |
| **n8n (machine)** | `Authorization: Bearer <PORTAL_API_KEY>` | Every HTTP Request node to `/api/contacts` or `/api/stats` |

n8n **cannot** use Google admin login. If portal HTTP nodes return `401 Sign in required`, the Bearer API key header is missing.

## Endpoints n8n should call

- `GET  {BASE}/api/health` (no auth)
- `GET  {BASE}/api/contacts?...`
- `POST {BASE}/api/contacts`
- `PATCH {BASE}/api/contacts/:id`
- `GET  {BASE}/api/stats`

## Smoke test

```bash
export KEY='2e5559ab3d6c6c520534ad11841227924392e7a6d97f9bfb'
export BASE='https://msratyvmnuvozuthgkmi.supabase.co/functions/v1/outreach-api'

curl -sS "$BASE/api/health"
curl -sS "$BASE/api/contacts?limit=1" -H "Authorization: Bearer $KEY"
curl -sS "$BASE/api/stats" -H "Authorization: Bearer $KEY"
```

Expect JSON, not `{"error":"Sign in required"}`.

## Workflow schedule reminder

1. **01 Lead Discovery** — every 3h — Apollo → create contacts  
2. **02 Email Resolver** — hourly — Queue → Email Found  
3. **03 Sequence Engine** — daily 08:00 IST — Day1/4/9 via Claude + Gmail  
4. **04 Reply Monitor** — every 2h — Gmail → Replied  

## Optional: patch script

If workflow JSONs are copied into `/n8n/`:

```bash
PORTAL_BASE_URL=https://msratyvmnuvozuthgkmi.supabase.co/functions/v1/outreach-api \
PORTAL_API_KEY=2e5559ab3d6c6c520534ad11841227924392e7a6d97f9bfb \
node n8n/patch-portal-auth.js --apply
```

Then re-import.

## Local Express (dev only)

`/portal` remains for offline/dev. Production for n8n is the Supabase URL above — not Railway, not Cloudflare tunnels.
