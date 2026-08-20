# Cowork ↔ Cursor handoff — Outreach portal + n8n

> For Claude Cowork / the n8n workspace. The portal already exists in the **powerhousetech** GitHub repo (built by Cursor). Do not rebuild it.

## Where things live

| Thing | Location |
|---|---|
| Portal (API + admin dashboard) | GitHub `powerhousetech-git/powerhousetech` → `/portal` |
| This handoff + n8n setup | `/n8n/` in that same repo |
| n8n workflow JSONs (01–04) | Cowork workspace (not yet committed to GitHub) |

## Two different “logins” — do not confuse them

| Who | How they auth | Used for |
|---|---|---|
| **Shreyas (human)** | Google sign-in as `shreyas@powerhousetech.in` (admin) | Dashboard UI at the portal URL (contacts / stats) |
| **n8n (machine)** | `Authorization: Bearer <PORTAL_API_KEY>` | Every HTTP Request node that calls `/api/contacts` or `/api/stats` |

n8n **cannot** use Google admin login. If portal HTTP nodes return `401 Sign in required`, the Bearer API key header is missing.

## Portal URL

Local (Cursor already has it running):

```
http://localhost:3000
```

- Health (no auth): `GET http://localhost:3000/api/health` → `{"ok":true,"service":"outreach-portal"}`
- Dashboard: open that origin in a browser → Sign in with Google as `shreyas@powerhousetech.in`
- Main site Admin also links via `PH_SITE.outreachPortalUrl` (`js/site-config.js`)

When deploying the Node app, replace the base URL everywhere and update `outreachPortalUrl`.

**Note:** `powerhousetech.in` is static Netlify. The outreach API is this separate Express app — not the marketing site HTML.

## Placeholders to replace in the 4 workflow JSONs

| Placeholder | Replace with |
|---|---|
| `REPLACE_PORTAL_BASE_URL` | `http://localhost:3000` (or deployed HTTPS origin) |
| `REPLACE_PORTAL_API_KEY` | Same value as `portal/.env` → `PORTAL_API_KEY` |
| `REPLACE_APOLLO_KEY_1` … `4` | Apollo keys (workflow 01) |
| `REPLACE_ANTHROPIC_API_KEY` | Anthropic key (workflow 03) |

## Required header on every portal HTTP node

```
Authorization: Bearer REPLACE_PORTAL_API_KEY
```

After substitution:

```
Authorization: Bearer <actual-secret>
```

Endpoints n8n should call:

- `GET {BASE}/api/contacts?...`
- `POST {BASE}/api/contacts`
- `PATCH {BASE}/api/contacts/:id`

## Patch script (in this repo)

If you copy the four JSON files into `/n8n/`:

```bash
# From repo root
node n8n/patch-portal-auth.js
```

That script:

1. Ensures every portal HTTP node has the Authorization header (adds if missing).
2. Leaves `REPLACE_*` placeholders intact unless you pass `--apply` with env vars.

```bash
PORTAL_BASE_URL=http://localhost:3000 \
PORTAL_API_KEY=your-secret \
node n8n/patch-portal-auth.js --apply
```

Then re-import the patched JSONs into n8n (or paste header manually once).

## Smoke test before activating schedules

```bash
export KEY='your-PORTAL_API_KEY'
export BASE='http://localhost:3000'

curl -sS "$BASE/api/health"
curl -sS "$BASE/api/contacts?limit=1" -H "Authorization: Bearer $KEY"
```

Expect JSON contacts payload, not `{"error":"Sign in required"}`.

## Workflow schedule reminder (already in n8n)

1. **01 Lead Discovery** — every 3h — Apollo → create contacts  
2. **02 Email Resolver** — hourly — Queue → Email Found  
3. **03 Sequence Engine** — daily 08:00 IST — Day1/4/9 via Claude + Gmail  
4. **04 Reply Monitor** — every 2h — Gmail → Replied  

Also configure **Gmail OAuth2** in n8n for workflows 03 and 04 before activating.

## If Cowork cannot see `/portal`

Pull / open the GitHub repo `powerhousetech-git/powerhousetech` (branch `main`). The portal is committed there. Start with:

```bash
cd portal && cp .env.example .env && npm install && npx prisma migrate dev && npm start
```
