# Sahasra Quotation Costing Portal

Separate client portal for **Sahasra Group** — not linked from the PowerhouseTech `/portal` or `/admin` surfaces.

## URL

- Production: https://powerhousetech.in/sahasra/
- Local: serve repo root and open `/sahasra/`

## Access

Google sign-in (same Firebase project as PowerhouseTech). Only emails listed in `sahasra_org_members` can enter.

Launch admin (seeded in migration):

- `shreyassinha.work@gmail.com` — role `admin`

## Stack

- Static UI: `/sahasra/` (HTML/CSS/JS)
- API: Supabase Edge Function `sahasra-costing-api`
- Database: `sahasra_*` tables (migration `20260831140000_sahasra_costing.sql`)

## Roles

| Role | Access |
|---|---|
| `costing_engineer` | Own costings, wizard, export |
| `reviewer` | Team costings + leadership dashboard |
| `admin` | Full access + leadership dashboard |

## Add a Sahasra user

```sql
insert into public.sahasra_org_members (email, org_id, full_name, role)
values (
  'user@example.com',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Full Name',
  'costing_engineer'
);
```
