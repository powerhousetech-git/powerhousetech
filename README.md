# PowerhouseTech

Marketing site and client workspace for **PowerhouseTech** — custom workflow automation for international teams (ops, sales, finance, AI).

## What’s live

Static HTML/CSS/JS published via Netlify (`netlify.toml` → publish `.`).

- Marketing: `index.html`, `services.html`, `industries.html`, `about.html`, `contact.html`
- **Client portal (post sign-in home):** `/portal`
- **Admin:** `/admin` — `shreyas@powerhousetech.in` (Supabase `is_admin`)
- **Outreach portal (admin-only):** `portal/` — Node API + dashboard for n8n contact sequences (`npm start` → `http://localhost:3000`). Linked from Admin → Outreach portal.
- **Demos:** `/sample-automations` — AI Sales Outreach, Card Capture, Invoice Radar samples
- Live Invoice Radar: `/app/invoice-radar`
- Sample demos: `/demo/ai-sales-outreach`, `/demo/card-capture`, `/invoice-dashboard/`
- Legacy `/dashboard/demo/` redirects to AI Sales Outreach

See `docs/SECURITY_PORTAL.md` for auth/admin security notes. Apply Supabase migration `20260810120000_portal_users_events.sql` and deploy Edge Functions `portal-session` + `admin-api`.

## Legacy note

Older CA product surfaces (NCE converter, Schedule III financial statements, working papers, statutory compliance reminders, desktop NCE download) are **retired from the product UI**. Backend fixtures/scripts under `fixtures/`, `coa/`, `supabase/`, and `docs/` may still exist for historical reference and are not marketed.

## Local

Serve the repo root as a static site (for example `npx serve .` or Netlify Dev). Open `/` for marketing.

### Outreach portal (n8n API)

```bash
cd portal && cp .env.example .env && npm install && npx prisma migrate dev && npm start
```

Dashboard requires Google admin sign-in. n8n uses `Authorization: Bearer $PORTAL_API_KEY`. See `portal/README.md` and `n8n/SETUP.md`.

## Contact

- shreyas@powerhousetech.in
- yash@powerhousetech.in
