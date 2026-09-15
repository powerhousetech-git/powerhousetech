# Deploy Evolution API (WhatsApp gateway) — no VPS

Evolution API is the WhatsApp gateway that the **n8n** workflows use to send the
post-sale messages. The dashboard only *reads* its status (green/red dot on the
Settings page). This folder gives you a **one-click, managed deploy** on either
**Render** or **Railway** — no server to patch, no Docker host to babysit.

Both options run three pieces: the **API**, a **PostgreSQL** database, and a
**Redis** cache, all wired together automatically.

---

## Option A — Render (Blueprint in this repo)

The blueprint lives at
[`render.yaml`](./render.yaml) and provisions the API + Postgres + Redis in one shot.

1. Make sure this repo is on GitHub (it is) and your Render account can see it.
2. Render Dashboard → **New +** → **Blueprint**.
3. Select this repository.
4. Set **Blueprint Path** to:
   ```
   clients/harshul/dashboard/deploy/evolution/render.yaml
   ```
5. Click **Apply**. Render creates `harshul-evolution-api`, `harshul-evolution-db`,
   and `harshul-evolution-redis`, and injects all connection strings.
6. Wait for the API service to go **Live**.

> **Plans / cost:** the API is on `starter` because free web services sleep and
> would drop the WhatsApp link. Postgres is `basic-256mb` (free Postgres is
> deleted after 30 days). Redis is `free`. Edit the plans in `render.yaml` to
> suit your budget.

**Grab the API key:** open the `harshul-evolution-api` service → **Environment**
→ copy `AUTHENTICATION_API_KEY` (Render generated it). That value is your
`EVOLUTION_API_KEY`. Your base URL is the service's `onrender.com` URL.

---

## Option B — Railway (official template)

Railway has a pre-wired one-click template (API + Postgres + Redis + volume):

- **Deploy:** https://railway.com/deploy/evolution-api-railway-template

1. Click the template, connect your Railway account, and **Deploy**.
2. Railway provisions everything and gives the API a public domain
   (Service → **Settings → Networking → Generate Domain** if not auto-created).
3. Open the `evolution-api` service → **Variables** → set/copy
   `AUTHENTICATION_API_KEY` (this is your `EVOLUTION_API_KEY`).
4. Your base URL is the generated `*.up.railway.app` domain.

Railway env vars match [`.env.evolution.example`](./.env.evolution.example); the
template already reference-links Postgres and Redis.

---

## After deploy: create the WhatsApp instance & scan the QR

The dashboard/n8n expect an instance named **`harshul`** (matches
`EVOLUTION_INSTANCE_NAME`). Replace `BASE_URL` and `API_KEY` below with your values.

1. **Create the instance:**
   ```bash
   curl -X POST "BASE_URL/instance/create" \
     -H "apikey: API_KEY" -H "Content-Type: application/json" \
     -d '{"instanceName":"harshul","integration":"WHATSAPP-BAILEYS","qrcode":true}'
   ```
2. **Get the QR code** (open in a browser, then scan from
   WhatsApp → Linked devices → Link a device):
   ```
   BASE_URL/instance/connect/harshul
   ```
   Or use the bundled **Evolution Manager** UI if your host exposes it.
3. **Confirm it's linked** — should report `"state":"open"`:
   ```bash
   curl "BASE_URL/instance/connectionState/harshul" -H "apikey: API_KEY"
   ```
   This is the exact endpoint the dashboard health check calls.

---

## Wire it into the dashboard

Set these in the dashboard's environment (`.env.local`, or the host's env):

```bash
EVOLUTION_API_URL=BASE_URL          # e.g. https://harshul-evolution-api.onrender.com
EVOLUTION_API_KEY=API_KEY           # AUTHENTICATION_API_KEY from the deploy
EVOLUTION_INSTANCE_NAME=harshul
```

The **Settings** page will then show Evolution as connected (green) once the
device is linked. See [`../../.env.example`](../../.env.example).

## Wire it into n8n

In the n8n workflows (`HRS_PS_02_AI_Message_Sender` etc.), point the Evolution
nodes / HTTP requests at the same `BASE_URL`, the `apikey` header = `API_KEY`,
and instance = `harshul`. Register the inbound webhook to the n8n webhook URL if
you need delivery/receipt events.

---

## Notes

- **Isolation:** this deploy is dedicated to Harshul (`harshul-evolution-*`
  resources, `evolution_harshul` cache/db client name). Do not share it with
  other clients.
- **Version:** pinned to `evoapicloud/evolution-api:v2.3.7`. Bump the tag in
  `render.yaml` (or the Railway variable) to upgrade.
- **Persistence:** WhatsApp session files live on the mounted disk/volume, so
  the link survives restarts and redeploys.
