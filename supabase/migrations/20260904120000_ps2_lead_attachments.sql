-- Lead card / PDF attachments (metadata; binary goes to n8n OCR when requested)
ALTER TABLE ps2_leads ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;
