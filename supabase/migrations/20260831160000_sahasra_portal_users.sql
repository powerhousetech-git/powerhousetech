-- Sahasra portal username/password logins (separate from Google / PowerhouseTech portal).

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.sahasra_portal_users (
  username text primary key,
  password_hash text not null,
  org_id uuid not null references public.sahasra_organizations (id) on delete cascade,
  full_name text,
  role text not null default 'costing_engineer'
    check (role in ('costing_engineer', 'reviewer', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.sahasra_portal_users enable row level security;

comment on table public.sahasra_portal_users is
  'Sahasra /sahasra/ portal logins. Verified via Edge Function + pgcrypto.';

create or replace function public.sahasra_verify_login(p_username text, p_password text)
returns table (username text, org_id uuid, full_name text, role text)
language sql
security definer
set search_path = public, extensions
as $$
  select u.username, u.org_id, u.full_name, u.role
  from public.sahasra_portal_users u
  where u.username = p_username
    and u.password_hash = extensions.crypt(p_password, u.password_hash);
$$;

revoke all on function public.sahasra_verify_login(text, text) from public;
grant execute on function public.sahasra_verify_login(text, text) to service_role;

-- Sample credentials (password = username)
insert into public.sahasra_portal_users (username, password_hash, org_id, full_name, role)
values
  ('SahasraAdmin', extensions.crypt('SahasraAdmin', extensions.gen_salt('bf')), 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Sahasra Admin', 'admin'),
  ('Sahasra_1', extensions.crypt('Sahasra_1', extensions.gen_salt('bf')), 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Sahasra User 1', 'costing_engineer'),
  ('Sahasra_2', extensions.crypt('Sahasra_2', extensions.gen_salt('bf')), 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Sahasra User 2', 'costing_engineer'),
  ('Sahasra_3', extensions.crypt('Sahasra_3', extensions.gen_salt('bf')), 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Sahasra User 3', 'costing_engineer'),
  ('Sahasra_4', extensions.crypt('Sahasra_4', extensions.gen_salt('bf')), 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Sahasra User 4', 'costing_engineer'),
  ('Sahasra_5', extensions.crypt('Sahasra_5', extensions.gen_salt('bf')), 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Sahasra User 5', 'costing_engineer')
on conflict (username) do update
set password_hash = excluded.password_hash,
    org_id = excluded.org_id,
    full_name = excluded.full_name,
    role = excluded.role;
