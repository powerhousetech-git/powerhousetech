import {
  db, ORG_ID, N8N_ACTOR, jsonResponse, forbidden,
  SENT_STATUSES, FOLLOW_UP_STATUSES, MAIL1_OR_LATER,
  logActivity, getWebhooks, getN8nApiKey, fireN8n, leadRowFromBody,
  type SessionUser,
  type Webhooks,
} from './helpers.ts';

export async function handleLeadIngestOps(
  req: Request,
  op: string,
  id: string,
  method: string,
  user: SessionUser,
  isN8n: boolean,
): Promise<Response | null> {
    if (op === 'ingest-file' && method === 'POST') {
      if (user.role === 'pt_admin') return forbidden();
      let body: Record<string, unknown> = {};
      try { body = await req.json(); } catch { /* */ }
      const filename = String(body.filename || 'upload.bin');
      const contentType = String(body.content_type || 'application/pdf');
      const contentBase64 = String(body.content_base64 || '');
      if (!contentBase64) return jsonResponse(400, { ok: false, error: 'content_base64 required' });
      if (contentBase64.length > 5_000_000) return jsonResponse(413, { ok: false, error: 'File too large (max ~3.5MB)' });

      const { data: batch, error } = await db().from('ps2_upload_batches').insert({
        organization_id: ORG_ID,
        source_type: 'business_card',
        filename,
        storage_path: contentType,
        total_records: 0,
        imported_count: 0,
        duplicate_count: 0,
        failed_count: 0,
        uploaded_by: user.id,
      }).select('*').single();
      if (error) throw error;

      const [wh, key] = await Promise.all([getWebhooks(), getN8nApiKey()]);
      const forwarded = Boolean(wh.extract_pdf);
      if (forwarded) {
        fireN8n(wh.extract_pdf, {
          event: 'pdf.uploaded',
          batch_id: batch.id,
          filename,
          content_type: contentType,
          content_base64: contentBase64,
        }, key);
      }
      await logActivity(user.id, 'lead', batch.id, 'file_ingested', `Uploaded ${filename} (business card)`);
      return jsonResponse(200, {
        ok: true,
        data: { batch, forwarded, message: forwarded
          ? 'Queued for n8n extraction'
          : 'Saved. Set extract_pdf webhook (or add leads manually) — card OCR workflow is not deployed yet.' },
      });
    }

    // ── LEAD ATTACHMENT (photo / PDF on a specific lead) ─────────────────────
    if (op === 'lead-attachment' && method === 'POST') {
      if (user.role === 'pt_admin') return forbidden();
      let body: Record<string, unknown> = {};
      try { body = await req.json(); } catch { /* */ }
      const leadId = String(body.lead_id || id || '');
      const filename = String(body.filename || 'attachment.bin');
      const contentType = String(body.content_type || 'application/octet-stream');
      const contentBase64 = String(body.content_base64 || '');
      const runOcr = body.run_ocr === true;
      if (!leadId) return jsonResponse(400, { ok: false, error: 'lead_id required' });
      if (!contentBase64) return jsonResponse(400, { ok: false, error: 'content_base64 required' });
      if (contentBase64.length > 5_000_000) return jsonResponse(413, { ok: false, error: 'File too large (max ~3.5MB)' });

      const { data: lead } = await db()
        .from('ps2_leads').select('id, attachments, full_name').eq('id', leadId).eq('organization_id', ORG_ID).maybeSingle();
      if (!lead) return jsonResponse(404, { ok: false, error: 'Lead not found' });

      const attachment = {
        id: crypto.randomUUID(),
        filename,
        content_type: contentType,
        uploaded_at: new Date().toISOString(),
        uploaded_by: user.id,
        size_approx: Math.round(contentBase64.length * 0.75),
        ocr_requested: runOcr,
      };
      const next = [...((lead.attachments as unknown[]) || []), attachment];
      const { data: updated, error } = await db().from('ps2_leads').update({
        attachments: next,
        updated_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
      }).eq('id', leadId).select('*').single();
      if (error) throw error;

      const [wh, key] = await Promise.all([getWebhooks(), getN8nApiKey()]);
      let forwarded = false;
      if (runOcr && wh.extract_pdf) {
        forwarded = true;
        fireN8n(wh.extract_pdf, {
          event: 'lead.attachment',
          lead_id: leadId,
          attachment_id: attachment.id,
          filename,
          content_type: contentType,
          content_base64: contentBase64,
        }, key);
      }
      await logActivity(user.id, 'lead', leadId, 'attachment_added', `Attached ${filename} to ${lead.full_name || leadId}`);
      return jsonResponse(200, {
        ok: true,
        data: {
          lead: updated,
          attachment,
          forwarded,
          message: forwarded
            ? 'Attached and queued for OCR'
            : (runOcr ? 'Attached. OCR webhook (extract_pdf / WF-E) not configured yet.' : 'Attached to lead'),
        },
      });
    }

    // ── UPLOAD BATCHES ────────────────────────────────────────────────────────
    if (op === 'upload-batches' && method === 'GET') {
      const { data, error } = await db().from('ps2_upload_batches')
        .select('*').eq('organization_id', ORG_ID)
        .order('created_at', { ascending: false }).limit(30);
      if (error) throw error;
      return jsonResponse(200, { ok: true, data: data || [] });
    }

    // ── TRIGGER N8N (portal "Run now" buttons → n8n webhooks) ────────────────
    if (op === 'trigger-n8n' && method === 'POST') {
      if (user.role === 'pt_admin') return forbidden();
      let body: Record<string, unknown> = {};
      try { body = await req.json(); } catch { /* */ }
      const which = String(body.workflow || body.which || '');
      const allowed: Record<string, keyof Webhooks> = {
        send_email: 'send_email',
        process_replies: 'process_replies',
        sync_sheets: 'sync_sheets',
        enrich_website: 'enrich_website',
        extract_pdf: 'extract_pdf',
      };
      const key = allowed[which];
      if (!key) {
        return jsonResponse(400, {
          ok: false,
          error: 'workflow must be one of: send_email, process_replies, sync_sheets, enrich_website, extract_pdf',
        });
      }
      const [wh, apiKey] = await Promise.all([getWebhooks(), getN8nApiKey()]);
      const url = wh[key];
      if (!url) return jsonResponse(400, { ok: false, error: `Webhook URL not configured for ${which}` });
      const payload = (body.payload as Record<string, unknown>) || {
        event: 'portal.trigger',
        workflow: which,
        triggered_by: user.username,
        triggered_at: new Date().toISOString(),
      };
      fireN8n(url, payload, apiKey);
      await logActivity(user.id, 'n8n', which, 'n8n_triggered', `Triggered n8n workflow: ${which}`);
      return jsonResponse(200, { ok: true, data: { workflow: which, url, fired: true } });
    }

  
  return null;
}
