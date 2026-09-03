# PS2 — Lead Management Portal

Standalone Next.js App Router portal for **Sahasra Group**, built by **PowerhouseTech**.

## Features

- Custom auth (bcrypt + JWT) with roles: `sahasra_admin`, `sahasra_employee`, `pt_admin`
- Master lead database (TanStack Table), uploads (PDF / Excel / Google Sheets)
- Outreach pipeline + mail sequence templates (TipTap)
- AI draft review queue
- Client project tracker (Kanban + table)
- Dashboard metrics & funnel (Recharts)
- n8n API key auth on selected routes

## Quick start

```bash
cd ps2
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000 — demo mode is on by default (`PS2_DEMO_MODE=true`).

### Demo logins

| Username | Password | Role |
|----------|----------|------|
| `sahasra_admin` | `sahasra_admin` | Full app (except system settings) |
| `sahasra_employee` | `sahasra_employee` | No users / mail-config |
| `pt_admin` | `pt_admin` | System settings only |

## Environment

See `.env.example`. For production Supabase (schema in `supabase/migrations/20260903120000_ps2_lead_management.sql`), set `SUPABASE_SERVICE_ROLE_KEY` and `PS2_DEMO_MODE=false`.

n8n calls use header `x-api-key: $N8N_API_KEY`.

## PRD

`products/ps2-lead-management-prd.md`
