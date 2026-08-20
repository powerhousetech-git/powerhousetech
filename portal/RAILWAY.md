# Deploy outreach portal to Railway (permanent URL for n8n)

The Cloudflare tunnel (`*.trycloudflare.com`) dies with the Cursor session.
Deploy this `portal/` folder to Railway for a stable HTTPS URL.

## 1. Create the project

1. Go to [railway.app](https://railway.app) → sign in with GitHub.
2. **New Project** → **Deploy from GitHub repo** → `powerhousetech-git/powerhousetech`.
3. Open the service → **Settings**:
   - **Root Directory:** `portal`
   - **Builder:** Dockerfile (preferred) or Nixpacks (`railway.json` is included)

## 2. Add a volume (SQLite persistence)

1. Service → **Settings** → **Volumes** → **Add Volume**
2. Mount path: `/data`
3. Confirm `DATABASE_URL` will be `file:/data/portal.db` (set below)

Without a volume, contacts reset on every deploy.

## 3. Environment variables

| Variable | Value |
|---|---|
| `PORT` | `3000` (Railway may inject `PORT` automatically — both work) |
| `DATABASE_URL` | `file:/data/portal.db` |
| `PORTAL_API_KEY` | Long random secret (same one you give n8n) |
| `ADMIN_EMAILS` | `shreyas@powerhousetech.in` |
| `FIREBASE_WEB_API_KEY` | Firebase web API key (see `portal/.env.example`) |
| `ADMIN_API_URL` | `https://msratyvmnuvozuthgkmi.supabase.co/functions/v1/admin-api?op=me` |

Generate a key:

```bash
openssl rand -hex 24
```

## 4. Public URL

Service → **Settings** → **Networking** → **Generate Domain**  
You get something like `https://outreach-portal-production-xxxx.up.railway.app`.

Smoke-test:

```bash
curl -sS https://YOUR.up.railway.app/api/health
curl -sS https://YOUR.up.railway.app/api/contacts?limit=1 \
  -H "Authorization: Bearer $PORTAL_API_KEY"
```

## 5. Point n8n + Admin at Railway

1. In the 4 workflow JSONs: find-replace the old `trycloudflare.com` URL → Railway URL.
2. Ensure `Authorization: Bearer <PORTAL_API_KEY>` matches Railway’s `PORTAL_API_KEY`.
3. Re-import / save workflows in n8n.
4. Update main site `js/site-config.js` → `outreachPortalUrl` to the Railway URL (Admin → Outreach portal link).

## 6. Still needed in n8n (manual)

- Gmail OAuth2 for workflows 03 and 04  
- Anthropic credential for workflow 03  
- Apollo keys already in workflow 01 (or set as n8n credentials)

## Optional: Railway CLI

```bash
npm i -g @railway/cli
railway login
cd portal
railway init
railway volume add --mount /data   # or add in dashboard
railway variables set PORTAL_API_KEY=... DATABASE_URL=file:/data/portal.db
railway up
railway domain
```
