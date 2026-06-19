-- Tracks authenticated desktop app downloads (written by Edge Functions via service role)
CREATE TABLE IF NOT EXISTS public.software_downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  firebase_uid TEXT NOT NULL,
  product TEXT NOT NULL DEFAULT 'nce_converter_macos',
  product_version TEXT,
  user_agent TEXT,
  downloaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS software_downloads_email_idx
  ON public.software_downloads (email);

CREATE INDEX IF NOT EXISTS software_downloads_downloaded_at_idx
  ON public.software_downloads (downloaded_at DESC);

CREATE INDEX IF NOT EXISTS software_downloads_product_idx
  ON public.software_downloads (product);

ALTER TABLE public.software_downloads ENABLE ROW LEVEL SECURITY;

-- No RLS policies: client access is via Edge Functions only (service role).
