# PowerhouseTech Outreach Portal

Node.js + Express + Prisma (SQLite) REST API and admin dashboard for n8n outreach workflows.

## Production (Railway)

See **[RAILWAY.md](./RAILWAY.md)** for deploying a permanent HTTPS URL + volume-backed SQLite so cloud n8n can reach the API.

Quick checklist: Root Directory `portal` → Volume mount `/data` → set `PORTAL_API_KEY` + `DATABASE_URL=file:/data/portal.db` → Generate Domain → update n8n base URL.

## Auth (admin-only)

| Caller | Auth |
|---|---|
| **Dashboard UI** | Google sign-in → Firebase ID token must belong to an admin (`admin-api?op=me` or `ADMIN_EMAILS`) |
| **n8n workflows** | `Authorization: Bearer <PORTAL_API_KEY>` |

Unauthenticated browsers can load HTML shells but **all `/api/*` routes (except `/api/health`) require auth**.

Open from the main site: **Admin → Outreach portal ↗** (URL from `PH_SITE.outreachPortalUrl` in `js/site-config.js`).

## Quick start

```bash
cd portal
cp .env.example .env   # set PORTAL_API_KEY
npm install
npx prisma migrate dev --name init
npm start              # http://localhost:3000
```

## API

- `GET /api/contacts` — filters: `status`, `status_in`, `email`, `domain`, `name`, `track`, `limit`, `sort`
- `POST /api/contacts` — create (unique on `domain` + `name`)
- `PATCH /api/contacts/:id` — update fields / status / sent timestamps
- `GET /api/stats` — counts by status/track, emails today, replies this week

### curl (n8n-style API key)

```bash
export KEY=dev-portal-api-key-change-me

curl -s http://localhost:3000/api/contacts?status=Queue \
  -H "Authorization: Bearer $KEY"

curl -s -X POST http://localhost:3000/api/contacts \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","firstName":"Test","lastName":"User","domain":"example.com","status":"Queue","source":"Apollo","track":"Track A - Startups"}'

curl -s -X PATCH http://localhost:3000/api/contacts/<id> \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"status":"Email Found","email":"test@example.com"}'
```

## n8n wiring

Workflow JSONs (when present under `/n8n/`) use `REPLACE_PORTAL_BASE_URL`. Replace with:

- Local: `http://localhost:3000`
- Deployed: your public HTTPS origin

Also set each HTTP Request node’s Authorization header to `Bearer <PORTAL_API_KEY>`.

See `/n8n/SETUP.md`.

## Production notes

- Swap SQLite → PostgreSQL by changing `provider` + `DATABASE_URL` in Prisma.
- Put the service behind a private network or reverse proxy; rotate `PORTAL_API_KEY`.
- Update `js/site-config.js` → `outreachPortalUrl` to the deployed URL so Admin links correctly.
