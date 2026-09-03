-- Phase 1–2 Sahasra portal structure: statuses, true values, soft delete, comments.

-- Expand status lifecycle: draft → in_review → final
alter table public.sahasra_costings drop constraint if exists sahasra_costings_status_check;
alter table public.sahasra_costings
  add constraint sahasra_costings_status_check
  check (status in ('draft', 'in_review', 'final', 'submitted', 'approved', 'changes_requested', 'sent'));

-- Migrate legacy submitted → final
update public.sahasra_costings
set status = 'final'
where status = 'submitted';

alter table public.sahasra_costings
  add column if not exists true_margin numeric,
  add column if not exists true_quote_price numeric,
  add column if not exists true_value_addition numeric,
  add column if not exists true_value_updated_at timestamptz,
  add column if not exists true_value_updated_by text,
  add column if not exists exported_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists calc_margin numeric,
  add column if not exists calc_quote_price numeric,
  add column if not exists calc_value_addition numeric;

comment on column public.sahasra_costings.true_margin is 'PM-entered true margin after negotiation';
comment on column public.sahasra_costings.calc_margin is 'Snapshot of calculated margin at finalize/export';

create index if not exists sahasra_costings_deleted_idx
  on public.sahasra_costings (org_id, deleted_at);

create table if not exists public.sahasra_costing_comments (
  id bigserial primary key,
  costing_id uuid not null references public.sahasra_costings (id) on delete cascade,
  author text not null,
  body text not null,
  is_flag boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists sahasra_costing_comments_costing_idx
  on public.sahasra_costing_comments (costing_id, created_at desc);

alter table public.sahasra_costing_comments enable row level security;

comment on table public.sahasra_costing_comments is
  'Admin flags/comments on Sahasra costings; visible to owning PM.';
