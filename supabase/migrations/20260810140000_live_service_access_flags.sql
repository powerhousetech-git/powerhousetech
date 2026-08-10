-- Live dashboard access flags for each product service.
-- Demos remain open to every signed-in user (general access); these columns gate live apps only.

alter table public.user_service_entitlements
  add column if not exists ai_sales_outreach_enabled boolean not null default false,
  add column if not exists card_capture_enabled boolean not null default false;

create index if not exists user_service_entitlements_outreach_idx
  on public.user_service_entitlements (ai_sales_outreach_enabled)
  where ai_sales_outreach_enabled = true;

create index if not exists user_service_entitlements_card_capture_idx
  on public.user_service_entitlements (card_capture_enabled)
  where card_capture_enabled = true;

comment on column public.user_service_entitlements.ai_sales_outreach_enabled is
  'Live AI Sales Outreach dashboard access (demos stay public).';
comment on column public.user_service_entitlements.card_capture_enabled is
  'Live Card Capture dashboard access (demos stay public).';
comment on column public.user_service_entitlements.invoice_radar_enabled is
  'Live Invoice Radar dashboard access (demos stay public).';
