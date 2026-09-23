-- Global automation kill switch on outreach_config (default OFF)
ALTER TABLE public.outreach_config
  ADD COLUMN IF NOT EXISTS system_enabled boolean NOT NULL DEFAULT false;
