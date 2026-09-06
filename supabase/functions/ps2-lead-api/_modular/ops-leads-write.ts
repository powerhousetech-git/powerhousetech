import {
  db, ORG_ID, N8N_ACTOR, jsonResponse, forbidden,
  SENT_STATUSES, FOLLOW_UP_STATUSES, MAIL1_OR_LATER,
  logActivity, getWebhooks, getN8nApiKey, fireN8n, leadRowFromBody,
  type SessionUser,
} from './helpers.ts';

export async function handleLeadWriteOps(
  req: Request, op: string, id: string, method: string, user: SessionUser, isN8n: boolean,
): Promise<Response | null> {
    if (op === 'lead' && method === 'POST') {
      if (user.role === 'pt_admin') return forbidden();
      let body: Record<string, unknown> = {};
      try { body = await req.json(); } catch { /* */ }
      const source = String(body.source || 'manual');
      const fullName = String(body.full_name || [body.first_name, body.last_name].filter(Boolean).join(' ') || '').trim();
      const email = body.email ? String(body.email).trim() : '';
      const company = body.company ? String(body.company).trim() : '';
      // Manual / single-row creates require a name and either email or company
      if (source === 'manual' || !Array.isArray((body as { leads?: unknown }).leads)) {
        if (!fullName) return jsonResponse(400, { ok: false, error: 'full_name is required' });
        if (!email && !company) {
          return jsonResponse(400, { ok: false, error: 'email or company is required' });
        }
      }
      const row = leadRowFromBody(body, source);
      const { data, error } = await db().from('ps2_leads').insert(row).select('*').single();
      if (error) throw error;
      await logActivity(user.id, 'lead', data.id, 'lead_created', `New lead: ${data.full_name || data.email} (${data.company})`);
      if (data.website) {
        const [wh, key] = await Promise.all([getWebhooks(), getN8nApiKey()]);
        fireN8n(wh.enrich_website, { event: 'lead.created', lead_id: data.id, website: data.website }, key);
      }
      return jsonResponse(201, { ok: true, data: { lead: data } });
    }

    // ── PATCH LEAD ───────────────────────────────────────────────────────────
    if (op === 'lead' && id && method === 'PATCH') {
      if (user.role === 'pt_admin') return forbidden();
      let body: Record<string, unknown> = {};
      try { body = await req.json(); } catch { /* */ }
      const allowed = ['first_name','last_name','full_name','company','designation','email','phone',
        'website','website_summary','status','assigned_to','tags','custom_intro','notes',
        'meeting_scheduled_at','last_activity_at','attachments'];
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const k of allowed) if (Object.prototype.hasOwnProperty.call(body, k)) patch[k] = body[k];
      if (Object.prototype.hasOwnProperty.call(body, 'status')) patch.last_activity_at = new Date().toISOString();

      const { data, error } = await db()
        .from('ps2_leads').update(patch).eq('id', id).eq('organization_id', ORG_ID).select('*').single();
      if (error) throw error;
      if (!data) return jsonResponse(404, { ok: false, error: 'Lead not found' });
      await logActivity(user.id, 'lead', id, 'lead_updated', `Lead updated: ${data.full_name || id}`);
      return jsonResponse(200, { ok: true, data: { lead: data } });
    }

    // ── DELETE LEAD ──────────────────────────────────────────────────────────
    if (op === 'lead' && id && method === 'DELETE') {
      if (user.role !== 'sahasra_admin') return forbidden('Only sahasra_admin can delete leads');
      const { error } = await db()
        .from('ps2_leads').delete().eq('id', id).eq('organization_id', ORG_ID);
      if (error) throw error;
      await logActivity(user.id, 'lead', id, 'lead_deleted', `Lead deleted`);
      return jsonResponse(200, { ok: true });
    }

    // ── BULK LEADS ───────────────────────────────────────────────────────────
    if (op === 'leads-bulk' && method === 'POST') {
      if (user.role === 'pt_admin') return forbidden();
      let body: Record<string, unknown> = {};
      try { body = await req.json(); } catch { /* */ }
      const ids = (body.ids as string[]) || [];
      const action = body.action as string;
      const payload = body.payload as Record<string, unknown> || {};
      if (!ids.length || !action) return jsonResponse(400, { ok: false, error: 'ids and action required' });

      if (action === 'delete') {
        if (user.role !== 'sahasra_admin') return forbidden();
        const { error } = await db().from('ps2_leads').delete().in('id', ids).eq('organization_id', ORG_ID);
        if (error) throw error;
        return jsonResponse(200, { ok: true, data: { affected: ids.length } });
      }
      if (action === 'assign' || action === 'tag') {
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (action === 'assign') patch.assigned_to = payload.assigned_to;
        if (action === 'tag') patch.tags = payload.tags;
        const { error } = await db().from('ps2_leads').update(patch).in('id', ids).eq('organization_id', ORG_ID);
        if (error) throw error;
        return jsonResponse(200, { ok: true, data: { affected: ids.length } });
      }
      return jsonResponse(400, { ok: false, error: 'Unknown action' });
    }

    // ── BULK IMPORT (Excel / Sheets / n8n upsert) ────────────────────────────
    if (op === 'leads-import' && method === 'POST') {
      if (user.role === 'pt_admin') return forbidden();
      let body: Record<string, unknown> = {};
      try { body = await req.json(); } catch { /* */ }
      const incoming = (body.leads as Record<string, unknown>[]) || [];
      const source = String(body.source || 'excel');
      if (!['business_card', 'excel', 'google_sheet', 'manual'].includes(source)) {
        return jsonResponse(400, { ok: false, error: 'Invalid source' });
      }
      if (!incoming.length) return jsonResponse(400, { ok: false, error: 'leads array required' });

      let batchId = (body.batch_id as string) || null;
      if (!batchId) {
        const { data: batch, error: bErr } = await db().from('ps2_upload_batches').insert({
          organization_id: ORG_ID,
          source_type: source,
          filename: body.filename || null,
          total_records: incoming.length,
          imported_count: 0,
          duplicate_count: 0,
          failed_count: 0,
          uploaded_by: user.id,
        }).select('id').single();
        if (bErr) throw bErr;
        batchId = batch.id;
      }

      const emails = incoming
        .map(l => l.email ? String(l.email).trim().toLowerCase() : '')
        .filter(Boolean);
      const { data: existingRows } = emails.length
        ? await db().from('ps2_leads').select('id, email').eq('organization_id', ORG_ID)
        : { data: [] as { id: string; email: string | null }[] };
      const existingByEmail = new Map(
        (existingRows || [])
          .filter(r => r.email)
          .map(r => [String(r.email).trim().toLowerCase(), r]),
      );

      const upsert = body.upsert === true || source === 'google_sheet';
      const toInsert: Record<string, unknown>[] = [];
      const toUpdate: { id: string; row: Record<string, unknown> }[] = [];
      let duplicates = 0;
      let failed = 0;

      for (const item of incoming) {
        const email = item.email ? String(item.email).trim().toLowerCase() : '';
        const full = String(item.full_name || [item.first_name, item.last_name].filter(Boolean).join(' ') || '').trim();
        const company = item.company ? String(item.company).trim() : '';
        // Single-row manual empties: require name + (email or company). Bulk imports stay lenient.
        if (incoming.length === 1 && source === 'manual') {
          if (!full || (!email && !company)) { failed += 1; continue; }
        }
        if (!email && !full && !company && !item.phone) { failed += 1; continue; }
        const hit = email ? existingByEmail.get(email) : undefined;
        if (hit && !upsert) { duplicates += 1; continue; }
        const row = leadRowFromBody(item, source, { upload_batch_id: batchId });
        if (email) row.email = email;
        if (hit && upsert) {
          toUpdate.push({ id: hit.id, row: {
            first_name: row.first_name, last_name: row.last_name, full_name: row.full_name,
            company: row.company, designation: row.designation, phone: row.phone,
            website: row.website, notes: row.notes, custom_intro: row.custom_intro,
            updated_at: new Date().toISOString(),
          }});
        } else {
          toInsert.push(row);
          if (email) existingByEmail.set(email, { id: 'pending', email });
        }
      }

      let imported = 0;
      const created: { id: string; website: string | null }[] = [];
      if (toInsert.length) {
        const { data: inserted, error } = await db().from('ps2_leads').insert(toInsert).select('id, website');
        if (error) throw error;
        imported += (inserted || []).length;
        for (const r of inserted || []) created.push(r);
      }
      for (const u of toUpdate) {
        const { error } = await db().from('ps2_leads').update(u.row).eq('id', u.id).eq('organization_id', ORG_ID);
        if (error) { failed += 1; continue; }
        imported += 1;
      }

      await db().from('ps2_upload_batches').update({
        total_records: incoming.length,
        imported_count: imported,
        duplicate_count: duplicates,
        failed_count: failed,
      }).eq('id', batchId);

      await logActivity(user.id, 'lead', batchId, 'leads_imported',
        `Imported ${imported} leads from ${source} (${duplicates} duplicates, ${failed} failed)`);

      if (created.some(c => c.website)) {
        const [wh, key] = await Promise.all([getWebhooks(), getN8nApiKey()]);
        for (const c of created) {
          if (c.website) fireN8n(wh.enrich_website, { event: 'lead.created', lead_id: c.id, website: c.website }, key);
        }
      }

      return jsonResponse(200, {
        ok: true,
        data: { batch_id: batchId, imported, duplicates, failed, total: incoming.length },
      });
    }

    // ── INGEST FILE (PDF business cards → n8n Workflow extract) ──────────────

  
  return null;
}
