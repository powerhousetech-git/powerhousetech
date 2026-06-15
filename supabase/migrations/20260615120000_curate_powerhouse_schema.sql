-- PowerHouse curated backend schema
-- Firebase Auth stays client-side; optional firebase_uid links jobs to users later.

comment on table public.mapping_jobs is
  'Async Tally / trial-balance conversion jobs. Written by Edge Functions (service role only).';

alter table public.mapping_jobs
  add column if not exists firebase_uid text,
  add column if not exists entity_name text,
  add column if not exists source_filename text,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists mapping_jobs_firebase_uid_idx
  on public.mapping_jobs (firebase_uid)
  where firebase_uid is not null;

create index if not exists mapping_jobs_started_at_idx
  on public.mapping_jobs (started_at desc);

create or replace function public.set_mapping_jobs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists mapping_jobs_updated_at on public.mapping_jobs;
create trigger mapping_jobs_updated_at
  before update on public.mapping_jobs
  for each row execute function public.set_mapping_jobs_updated_at();

-- Purge jobs past expiry (call from pg_cron or manual maintenance)
create or replace function public.purge_expired_mapping_jobs()
returns integer
language sql
security definer
set search_path = public
as $$
  with deleted as (
    delete from public.mapping_jobs
    where expires_at < now()
    returning 1
  )
  select count(*)::integer from deleted;
$$;

comment on function public.purge_expired_mapping_jobs() is
  'Deletes mapping_jobs rows past expires_at. Schedule via pg_cron if desired.';
