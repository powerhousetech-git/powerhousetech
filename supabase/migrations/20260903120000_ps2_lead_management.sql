-- PS2 Lead Management Portal schema
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.ps2_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.ps2_users (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.ps2_organizations (id) on delete cascade,
  username text not null unique,
  password_hash text not null,
  full_name text,
  role text not null check (role in ('sahasra_admin', 'sahasra_employee', 'pt_admin')),
  outlook_account text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ps2_upload_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.ps2_organizations (id) on delete cascade,
  source_type text not null check (source_type in ('business_card', 'excel', 'google_sheet', 'manual')),
  filename text,
  storage_path text,
  total_records int not null default 0,
  imported_count int not null default 0,
  duplicate_count int not null default 0,
  failed_count int not null default 0,
  uploaded_by uuid references public.ps2_users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.ps2_leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.ps2_organizations (id) on delete cascade,
  first_name text,
  last_name text,
  full_name text,
  company text,
  designation text,
  email text,
  phone text,
  website text,
  website_summary text,
  status text not null default 'new' check (status in (
    'new', 'mail_1_sent',
    'follow_up_1', 'follow_up_2', 'follow_up_3', 'follow_up_4', 'follow_up_5',
    'follow_up_6', 'follow_up_7', 'follow_up_8', 'follow_up_9', 'follow_up_10',
    'responded', 'meeting_scheduled', 'converted', 'discarded'
  )),
  source text not null default 'manual' check (source in ('business_card', 'excel', 'google_sheet', 'manual')),
  assigned_to uuid references public.ps2_users (id) on delete set null,
  tags text[] not null default '{}',
  custom_intro text,
  notes text,
  meeting_scheduled_at timestamptz,
  upload_batch_id uuid references public.ps2_upload_batches (id) on delete set null,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ps2_leads_org_status_idx on public.ps2_leads (organization_id, status);
create index if not exists ps2_leads_org_email_idx on public.ps2_leads (organization_id, email);
create index if not exists ps2_leads_assigned_idx on public.ps2_leads (assigned_to);
create index if not exists ps2_leads_created_idx on public.ps2_leads (created_at desc);

create table if not exists public.ps2_lead_emails (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.ps2_leads (id) on delete cascade,
  direction text not null check (direction in ('outbound', 'inbound')),
  subject text,
  body text,
  sentiment text check (sentiment is null or sentiment in ('positive', 'neutral', 'negative')),
  sequence_step int,
  status text not null default 'draft' check (status in ('draft', 'pending_review', 'approved', 'sent', 'rejected')),
  is_ai_draft boolean not null default false,
  sent_at timestamptz,
  received_at timestamptz,
  created_by uuid references public.ps2_users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists ps2_lead_emails_lead_idx on public.ps2_lead_emails (lead_id, created_at desc);
create index if not exists ps2_lead_emails_review_idx on public.ps2_lead_emails (status) where status = 'pending_review';

create table if not exists public.ps2_mail_sequence_config (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.ps2_organizations (id) on delete cascade,
  step_number int not null check (step_number between 1 and 11),
  label text not null,
  day_offset int not null default 0,
  subject_template text not null default '',
  body_template text not null default '',
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (organization_id, step_number)
);

create table if not exists public.ps2_google_sheet_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.ps2_organizations (id) on delete cascade,
  sheet_url text not null,
  sheet_id text,
  tab_name text,
  column_mapping jsonb not null default '{}'::jsonb,
  sync_interval_hours int not null default 24 check (sync_interval_hours in (1, 3, 6, 12, 24)),
  last_synced_at timestamptz,
  is_active boolean not null default true,
  created_by uuid references public.ps2_users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.ps2_client_projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.ps2_organizations (id) on delete cascade,
  lead_id uuid references public.ps2_leads (id) on delete set null,
  client_name text not null,
  project_name text not null,
  order_value numeric(14, 2),
  stage text not null default 'enquiry_received' check (stage in (
    'enquiry_received', 'bid_submitted', 'order_won', 'production',
    'quality_check', 'delivery', 'completed', 'on_hold'
  )),
  assigned_to uuid references public.ps2_users (id) on delete set null,
  target_date date,
  notes text,
  quotation_ref text,
  documents jsonb not null default '[]'::jsonb,
  stage_entered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ps2_projects_org_stage_idx on public.ps2_client_projects (organization_id, stage);

create table if not exists public.ps2_stage_transitions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.ps2_client_projects (id) on delete cascade,
  from_stage text,
  to_stage text not null,
  notes text,
  documents jsonb not null default '[]'::jsonb,
  transitioned_by uuid references public.ps2_users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.ps2_system_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.ps2_organizations (id) on delete cascade,
  key text not null,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (organization_id, key)
);

create table if not exists public.ps2_activity_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.ps2_organizations (id) on delete cascade,
  actor_id uuid references public.ps2_users (id) on delete set null,
  entity_type text not null,
  entity_id text,
  action text not null,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ps2_activity_org_idx on public.ps2_activity_log (organization_id, created_at desc);

-- RLS: service-role only (custom JWT auth in Next.js)
alter table public.ps2_organizations enable row level security;
alter table public.ps2_users enable row level security;
alter table public.ps2_leads enable row level security;
alter table public.ps2_lead_emails enable row level security;
alter table public.ps2_mail_sequence_config enable row level security;
alter table public.ps2_upload_batches enable row level security;
alter table public.ps2_google_sheet_connections enable row level security;
alter table public.ps2_client_projects enable row level security;
alter table public.ps2_stage_transitions enable row level security;
alter table public.ps2_system_settings enable row level security;
alter table public.ps2_activity_log enable row level security;

-- Seed org + default admin (password: sahasra_admin)
insert into public.ps2_organizations (id, name)
values ('b1c2d3e4-f5a6-7890-abcd-ef1234567890', 'Sahasra Group')
on conflict (id) do nothing;

insert into public.ps2_users (id, organization_id, username, password_hash, full_name, role, outlook_account)
values (
  'c2d3e4f5-a6b7-8901-bcde-f12345678901',
  'b1c2d3e4-f5a6-7890-abcd-ef1234567890',
  'sahasra_admin',
  extensions.crypt('sahasra_admin', extensions.gen_salt('bf')),
  'Sahasra Admin',
  'sahasra_admin',
  'admin@sahasra.example'
)
on conflict (username) do update
set password_hash = excluded.password_hash,
    full_name = excluded.full_name,
    role = excluded.role;

insert into public.ps2_users (id, organization_id, username, password_hash, full_name, role, outlook_account)
values (
  'd3e4f5a6-b7c8-9012-cdef-123456789012',
  'b1c2d3e4-f5a6-7890-abcd-ef1234567890',
  'pt_admin',
  extensions.crypt('pt_admin', extensions.gen_salt('bf')),
  'PowerhouseTech Admin',
  'pt_admin',
  null
)
on conflict (username) do update
set password_hash = excluded.password_hash,
    role = excluded.role;

insert into public.ps2_users (id, organization_id, username, password_hash, full_name, role, outlook_account)
values (
  'e4f5a6b7-c8d9-0123-def0-234567890123',
  'b1c2d3e4-f5a6-7890-abcd-ef1234567890',
  'sahasra_employee',
  extensions.crypt('sahasra_employee', extensions.gen_salt('bf')),
  'Sahasra Employee',
  'sahasra_employee',
  'employee@sahasra.example'
)
on conflict (username) do update
set password_hash = excluded.password_hash,
    role = excluded.role;

-- Default mail sequence (Mail 1 + 10 follow-ups)
insert into public.ps2_mail_sequence_config (organization_id, step_number, label, day_offset, subject_template, body_template, is_active)
select
  'b1c2d3e4-f5a6-7890-abcd-ef1234567890',
  s.n,
  case when s.n = 1 then 'Mail 1' else 'Follow-up ' || (s.n - 1)::text end,
  case when s.n = 1 then 0 else (s.n - 1) * 3 end,
  case when s.n = 1
    then 'Introduction — Sahasra Group x {{company}}'
    else 'Following up — {{company}}'
  end,
  case when s.n = 1
    then '<p>Hi {{first_name}},</p><p>{{custom_intro}}</p><p>I am reaching out from Sahasra Group regarding opportunities with {{company}}.</p><p>Best regards</p>'
    else '<p>Hi {{first_name}},</p><p>Just following up on my earlier note about {{company}}.</p><p>Happy to schedule a quick call.</p>'
  end,
  true
from generate_series(1, 11) as s(n)
on conflict (organization_id, step_number) do nothing;

insert into public.ps2_system_settings (organization_id, key, value)
values
  ('b1c2d3e4-f5a6-7890-abcd-ef1234567890', 'ai_prompt_first_email', '{"prompt": "Write a short personalised cold email using the lead fields and website summary."}'::jsonb),
  ('b1c2d3e4-f5a6-7890-abcd-ef1234567890', 'ai_prompt_reply', '{"prompt": "Draft a professional reply based on the inbound email and sentiment."}'::jsonb),
  ('b1c2d3e4-f5a6-7890-abcd-ef1234567890', 'ai_prompt_sentiment', '{"prompt": "Classify reply sentiment as positive, neutral, or negative."}'::jsonb),
  ('b1c2d3e4-f5a6-7890-abcd-ef1234567890', 'n8n_webhooks', '{"send_email": "", "sync_sheets": "", "process_replies": ""}'::jsonb),
  ('b1c2d3e4-f5a6-7890-abcd-ef1234567890', 'outlook_accounts', '[{"email": "admin@sahasra.example", "connected": true}, {"email": "employee@sahasra.example", "connected": false}]'::jsonb)
on conflict (organization_id, key) do nothing;

comment on table public.ps2_organizations is 'PS2 Lead Management organizations';
comment on table public.ps2_users is 'PS2 custom auth users (bcrypt + JWT in Next.js)';
comment on table public.ps2_leads is 'PS2 master lead database';
comment on table public.ps2_lead_emails is 'PS2 outbound/inbound email timeline + AI drafts';
comment on table public.ps2_client_projects is 'PS2 Segment 2 client project tracker';
