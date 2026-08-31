-- Sahasra Quotation Costing — separate client portal (not PowerhouseTech admin).

create table if not exists public.sahasra_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  default_currency text not null default 'USD' check (default_currency in ('USD', 'INR')),
  created_at timestamptz not null default now()
);

create table if not exists public.sahasra_org_defaults (
  org_id uuid primary key references public.sahasra_organizations (id) on delete cascade,
  freight_in_pct numeric not null default 5,
  inventory_carrying_pct numeric not null default 1,
  rejection_pct numeric not null default 1,
  overhead_pct numeric not null default 3,
  freight_out_pct numeric not null default 5,
  margin_pct numeric not null default 10,
  labour_elec_multiplier numeric not null default 0.005,
  pcb_tooling_default numeric not null default 600,
  updated_at timestamptz not null default now(),
  updated_by text
);

create table if not exists public.sahasra_org_members (
  email text primary key,
  org_id uuid not null references public.sahasra_organizations (id) on delete cascade,
  full_name text,
  role text not null default 'costing_engineer'
    check (role in ('costing_engineer', 'reviewer', 'admin')),
  created_at timestamptz not null default now()
);

create index if not exists sahasra_org_members_org_idx
  on public.sahasra_org_members (org_id);

create table if not exists public.sahasra_costings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.sahasra_organizations (id) on delete cascade,
  client_name text not null,
  assembly_name text not null,
  currency text not null default 'USD' check (currency in ('USD', 'INR')),
  exchange_rate numeric,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'approved', 'changes_requested', 'sent')),
  current_step integer not null default 1 check (current_step between 1 and 7),
  created_by text not null,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  quantity integer,
  bom_cost_elec numeric,
  bom_cost_mech numeric,
  pcb_cost numeric,
  freight_in_pct_override numeric,
  inventory_carrying_pct_override numeric,
  labour_elec_override numeric,
  labour_mech numeric,
  functional_ict_testing numeric,
  programming numeric default 0,
  lubrication_grease numeric,
  aoi numeric,
  pca_labeling numeric,
  packaging_forwarding numeric,
  smt_pth integer,
  pcb_vendor text,
  pcb_price numeric,
  pcb_size text,
  pcb_layer integer,
  pcb_tooling_override numeric,
  smt_stencil numeric,
  mech_pkg_dev_tooling numeric,
  misc_tooling numeric,
  parts_lead_time text,
  production_lead_time text,
  engineering_lead_time text,
  rejection_pct_override numeric,
  overhead_pct_override numeric,
  freight_out_pct_override numeric,
  margin_pct_override numeric
);

create index if not exists sahasra_costings_org_created_idx
  on public.sahasra_costings (org_id, created_at desc);

create index if not exists sahasra_costings_status_idx
  on public.sahasra_costings (org_id, status);

create table if not exists public.sahasra_audit_log (
  id bigserial primary key,
  costing_id uuid not null references public.sahasra_costings (id) on delete cascade,
  user_email text not null,
  field_name text not null,
  old_value text,
  new_value text,
  changed_at timestamptz not null default now()
);

create index if not exists sahasra_audit_log_costing_idx
  on public.sahasra_audit_log (costing_id, changed_at desc);

alter table public.sahasra_organizations enable row level security;
alter table public.sahasra_org_defaults enable row level security;
alter table public.sahasra_org_members enable row level security;
alter table public.sahasra_costings enable row level security;
alter table public.sahasra_audit_log enable row level security;

comment on table public.sahasra_org_members is
  'Sahasra portal access. Separate from portal_users.is_admin.';

-- Seed Sahasra Group + launch admin
insert into public.sahasra_organizations (id, name, default_currency)
values ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Sahasra Group', 'USD')
on conflict (id) do nothing;

insert into public.sahasra_org_defaults (org_id)
values ('a1b2c3d4-e5f6-7890-abcd-ef1234567890')
on conflict (org_id) do nothing;

insert into public.sahasra_org_members (email, org_id, full_name, role)
values (
  'shreyassinha.work@gmail.com',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Shreyas Sinha',
  'admin'
)
on conflict (email) do update
set role = 'admin',
    org_id = excluded.org_id,
    full_name = coalesce(excluded.full_name, public.sahasra_org_members.full_name);
