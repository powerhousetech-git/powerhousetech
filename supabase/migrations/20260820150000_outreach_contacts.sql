-- Outreach contacts for n8n portal API (camelCase JSON via edge function)
create table if not exists public.outreach_contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  first_name text not null,
  last_name text not null,
  email text,
  company text,
  domain text not null,
  title text,
  country text,
  track text,
  status text not null default 'Queue',
  source text default 'Apollo',
  all_permutations text,
  day1_sent_at timestamptz,
  day4_sent_at timestamptz,
  day9_sent_at timestamptz,
  replied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (domain, name)
);

create index if not exists outreach_contacts_status_idx on public.outreach_contacts (status);
create index if not exists outreach_contacts_email_idx on public.outreach_contacts (email);

create table if not exists public.outreach_portal_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.outreach_contacts enable row level security;
alter table public.outreach_portal_config enable row level security;
