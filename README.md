# Powerhouse Tech

Marketing site and client workspace for **Powerhouse Tech** — custom workflow automation for international teams (ops, sales, finance, AI).

## What’s live

Static HTML/CSS/JS published via Netlify (`netlify.toml` → publish `.`).

- Marketing: `index.html`, `services.html`, `industries.html`, `about.html`, `contact.html`
- **Demos:** `/sample-automations` — interactive dashboard cards (sign-in required to open)
- **Client portal:** `/portal` — Google sign-in, then pick a service
- **Admin:** `/admin` — opens automatically for `shreyas@powerhousetech.in` (Supabase `is_admin`)
- Invoice Radar live: `/app/invoice-radar`
- Invoice Radar sample: `/invoice-dashboard/`
- Med spa ROI dashboard: `/dashboard/demo/`
- Client portal (post sign-in home): `/portal`
- Live Invoice Radar: `/app/invoice-radar`
- Public demos: `/sample-automations`, `/dashboard/demo/`, `/invoice-dashboard/`
- Legacy Overview shell (opt-in only): `/app/workspace`

See `docs/SECURITY_PORTAL.md` for auth/admin security notes. Apply Supabase migration `20260810120000_portal_users_events.sql` and deploy Edge Functions `portal-session` + `admin-api`.

## Legacy note

Older CA product surfaces (NCE converter, Schedule III financial statements, working papers, statutory compliance reminders, desktop NCE download) are **retired from the product UI**. Backend fixtures/scripts under `fixtures/`, `coa/`, `supabase/`, and `docs/` may still exist for historical reference and are not marketed.

## Local

Serve the repo root as a static site (for example `npx serve .` or Netlify Dev). Open `/` for marketing.

## Contact

- shreyas@powerhousetech.in
- yash@powerhousetech.in
