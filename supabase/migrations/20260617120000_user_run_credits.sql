-- One complimentary tool run per signed-in user (keyed by email).

create table if not exists public.user_run_credits (
  email text primary key,
  runs_remaining integer not null default 1 check (runs_remaining >= 0),
  runs_used integer not null default 0 check (runs_used >= 0),
  last_tool_used text,
  first_used_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_run_credits_last_used_at_idx
  on public.user_run_credits (last_used_at desc nulls last);

alter table public.user_run_credits enable row level security;

comment on table public.user_run_credits is
  'Complimentary run allowance per user email. Managed by Edge Functions (service role).';

create or replace function public.set_user_run_credits_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_run_credits_updated_at on public.user_run_credits;
create trigger user_run_credits_updated_at
  before update on public.user_run_credits
  for each row execute function public.set_user_run_credits_updated_at();

-- Atomically consume one run; creates row with 1 credit on first use.
create or replace function public.consume_user_run_credit(p_email text, p_tool text)
returns table(ok boolean, runs_remaining integer, runs_used integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_remaining integer;
  v_used integer;
begin
  insert into public.user_run_credits (email, runs_remaining, runs_used)
  values (lower(trim(p_email)), 1, 0)
  on conflict (email) do nothing;

  update public.user_run_credits u
  set
    runs_remaining = u.runs_remaining - 1,
    runs_used = u.runs_used + 1,
    last_tool_used = nullif(trim(p_tool), ''),
    first_used_at = coalesce(u.first_used_at, now()),
    last_used_at = now()
  where u.email = lower(trim(p_email))
    and u.runs_remaining > 0
  returning u.runs_remaining, u.runs_used
  into v_remaining, v_used;

  if found then
    return query select true, v_remaining, v_used;
    return;
  end if;

  select u.runs_remaining, u.runs_used
  into v_remaining, v_used
  from public.user_run_credits u
  where u.email = lower(trim(p_email));

  return query select false, coalesce(v_remaining, 0), coalesce(v_used, 0);
end;
$$;

comment on function public.consume_user_run_credit(text, text) is
  'Decrements runs_remaining by 1 when available. Returns ok=false when exhausted.';
