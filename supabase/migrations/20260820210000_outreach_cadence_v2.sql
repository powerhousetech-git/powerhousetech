-- Cadence V2: cadence_days JSON, follow_up_dates, email logs, FollowN statuses
-- (Applied via Supabase MCP; kept in repo for reference.)

ALTER TABLE public.outreach_contacts
  ADD COLUMN IF NOT EXISTS follow_up_dates jsonb;

CREATE TABLE IF NOT EXISTS public.outreach_email_logs (
  id bigserial PRIMARY KEY,
  contact_id uuid NOT NULL REFERENCES public.outreach_contacts(id) ON DELETE CASCADE,
  follow_up_num integer NOT NULL,
  track text,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS outreach_email_logs_sent_at_idx ON public.outreach_email_logs (sent_at);
CREATE INDEX IF NOT EXISTS outreach_email_logs_follow_up_num_idx ON public.outreach_email_logs (follow_up_num);
CREATE INDEX IF NOT EXISTS outreach_email_logs_track_idx ON public.outreach_email_logs (track);

UPDATE public.outreach_contacts SET status = 'Follow1 Sent' WHERE status = 'Day1 Sent';
UPDATE public.outreach_contacts SET status = 'Follow2 Sent' WHERE status = 'Day4 Sent';
UPDATE public.outreach_contacts SET status = 'Follow3 Sent' WHERE status = 'Day9 Sent';
