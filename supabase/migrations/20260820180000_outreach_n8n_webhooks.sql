-- Optional seed for n8n webhook URLs used by outreach-api Controls triggers.
-- Safe to re-run (upserts by key).

INSERT INTO outreach_portal_config (key, value) VALUES
  ('n8n_webhook_base_url', 'https://shreyas-sinha.app.n8n.cloud/webhook'),
  ('n8n_discover_path', 'outreach-discover'),
  ('n8n_mail_path', 'outreach-mail')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
