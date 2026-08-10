-- Portal users, events, and admin role for client dashboards / admin console.
-- Accessed only via Edge Functions with service role (RLS enabled, no policies).

create table if not exists public.portal_users (
  email text primary key,
  firebase_uid text,
  display_name text,
  photo_url text,
  company text,
  phone text,
  is_admin boolean not null default false,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  login_count integer not null default 1,
  last_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists portal_users_last_seen_idx
  on public.portal_users (last_seen_at desc);

create index if not exists portal_users_admin_idx
  on public.portal_users (is_admin)
  where is_admin = true;

create table if not exists public.portal_events (
  id bigserial primary key,
  email text not null references public.portal_users (email) on delete cascade,
  event_type text not null,
  path text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists portal_events_email_created_idx
  on public.portal_events (email, created_at desc);

create index if not exists portal_events_type_created_idx
  on public.portal_events (event_type, created_at desc);

alter table public.portal_users enable row level security;
alter table public.portal_events enable row level security;

comment on table public.portal_users is
  'Signed-in portal users. is_admin grants /admin API access. Service-role only.';
comment on table public.portal_events is
  'Audit of portal/dashboard actions (sign_in, dashboard_view, demo_open, …).';

create or replace function public.set_portal_users_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists portal_users_updated_at on public.portal_users;
create trigger portal_users_updated_at
  before update on public.portal_users
  for each row execute function public.set_portal_users_updated_at();

-- Seed primary admin (idempotent)
insert into public.portal_users (email, display_name, is_admin, login_count)
values ('shreyas@powerhousetech.in', 'Shreyas Sinha', true, 0)
on conflict (email) do update
set is_admin = true,
    display_name = coalesce(nullif(public.portal_users.display_name, ''), excluded.display_name);
