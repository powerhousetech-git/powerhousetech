-- Per-user service entitlements (Invoice Radar and future services).
-- Managed by Edge Functions with service role only.

create table if not exists public.user_service_entitlements (
  email text primary key,
  invoice_radar_enabled boolean not null default false,
  invoice_radar_web_app_url text,
  invoice_radar_client_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_service_entitlements_enabled_idx
  on public.user_service_entitlements (invoice_radar_enabled)
  where invoice_radar_enabled = true;

alter table public.user_service_entitlements enable row level security;

comment on table public.user_service_entitlements is
  'Service entitlements per user email. invoice_radar_client_key is server-only (Edge Function proxy).';

create or replace function public.set_user_service_entitlements_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_service_entitlements_updated_at on public.user_service_entitlements;
create trigger user_service_entitlements_updated_at
  before update on public.user_service_entitlements
  for each row execute function public.set_user_service_entitlements_updated_at();
