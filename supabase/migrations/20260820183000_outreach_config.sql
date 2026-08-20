-- Email sequence cadence (single row id=1) for n8n workflow 03 + Controls UI
create table if not exists public.outreach_config (
  id integer primary key check (id = 1),
  sequence_day1 integer not null default 1,
  sequence_day2 integer not null default 4,
  sequence_day3 integer not null default 9,
  updated_at timestamptz not null default now()
);

alter table public.outreach_config enable row level security;

insert into public.outreach_config (id, sequence_day1, sequence_day2, sequence_day3)
values (1, 1, 4, 9)
on conflict (id) do nothing;
