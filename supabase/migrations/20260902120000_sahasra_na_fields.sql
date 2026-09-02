-- Track fields marked Not Applicable (NA) on Sahasra costings.
-- Numeric columns stay null; Excel export writes "NA" for listed fields.

alter table public.sahasra_costings
  add column if not exists na_fields jsonb not null default '[]'::jsonb;

comment on column public.sahasra_costings.na_fields is
  'JSON array of field names marked NA (not applicable) for this costing.';
