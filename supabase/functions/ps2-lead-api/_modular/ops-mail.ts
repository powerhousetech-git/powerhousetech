import {
  db, ORG_ID, N8N_ACTOR, jsonResponse, forbidden,
  SENT_STATUSES, FOLLOW_UP_STATUSES, MAIL1_OR_LATER,
  logActivity, getWebhooks, getN8nApiKey, fireN8n, leadRowFromBody,
  type SessionUser,
} from './helpers.ts';

export async function handleMailOps(
  req: Request, op: string, id: string, method: string, user: SessionUser, isN8n: boolean,
): Promise<Response | null> {
  const url = new URL(req.url);


    if (op === 'emails' && method === 'GET') {
      const leadId = url.searchParams.get('lead_id');
      const status = url.searchParams.get('status');
      let q = db().from('ps2_lead_emails').select('*')
        .order('created_at', { ascending: false }).limit(200);
      if (leadId) q = q.eq('lead_id', leadId);
      if (status) q = q.eq('status', status);
      const { data, error } = await q;
      if (error) throw error;
      return jsonResponse(200, { ok: true, data: data || [] });
    }

    // ── REVIEW DRAFTS ─────────────────────────────────────────────────────────
    if (op === 'review-drafts' && method === 'GET') {
      const assignedTo = url.searchParams.get('assigned_to');
      const { data: emails } = await db()
        .from('ps2_lead_emails')
        .select('*, ps2_leads!lead_id(id, full_name, company, assigned_to)')
        .eq('status', 'pending_review')
        .order('created_at', { ascending: false });

      let drafts = emails || [];
      if (assignedTo) {
        drafts = drafts.filter(e => {
          const lead = (e as Record<string,unknown>)['ps2_leads'] as Record<string,unknown>;
          return lead && lead['assigned_to'] === assignedTo;
        });
      }

      const leadIds = [...new Set(drafts.map(d => d.lead_id).filter(Boolean))] as string[];
      const inboundsByLead = new Map<string, Record<string, unknown>[]>();
      if (leadIds.length) {
        const { data: inbounds } = await db()
          .from('ps2_lead_emails')
          .select('id, lead_id, subject, body, sentiment, received_at, created_at, thread_id, direction')
          .in('lead_id', leadIds)
          .eq('direction', 'inbound')
          .order('created_at', { ascending: false });
        for (const row of inbounds || []) {
          const lid = String(row.lead_id);
          const list = inboundsByLead.get(lid) || [];
          list.push(row as Record<string, unknown>);
          inboundsByLead.set(lid, list);
        }
      }

      const enriched = drafts.map(d => {
        const lid = String(d.lead_id || '');
        const list = inboundsByLead.get(lid) || [];
        let related: Record<string, unknown> | null = null;
        if (d.thread_id) {
          related = list.find(r => r.thread_id === d.thread_id) || null;
        }
        if (!related) related = list[0] || null;
        return { ...d, related_inbound: related };
      });

      return jsonResponse(200, { ok: true, data: enriched });
    }

    // ── CREATE EMAIL ──────────────────────────────────────────────────────────
    if (op === 'email' && method === 'POST') {
      if (user.role === 'pt_admin') return forbidden();
      let body: Record<string, unknown> = {};
      try { body = await req.json(); } catch { /* */ }
      if (!body.lead_id) return jsonResponse(400, { ok: false, error: 'lead_id required' });
      const row = {
        lead_id: body.lead_id,
        direction: body.direction || 'outbound',
        subject: body.subject || null,
        body: body.body || null,
        sentiment: body.sentiment || null,
        sequence_step: body.sequence_step || null,
        status: body.status || 'draft',
        is_ai_draft: Boolean(body.is_ai_draft),
        sent_at: body.sent_at || null,
        received_at: body.received_at || null,
        created_by: user.id,
      };
      const { data, error } = await db().from('ps2_lead_emails').insert(row).select('*').single();
      if (error) throw error;

      // Update lead last_activity_at
      await db().from('ps2_leads')
        .update({ last_activity_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', String(body.lead_id));

      const action = row.direction === 'inbound' ? 'reply_received' : 'email_sent';
      const summary = row.direction === 'inbound'
        ? `Reply received (sentiment: ${row.sentiment || 'unknown'})`
        : `Email sent (step ${row.sequence_step || '?'})`;
      await logActivity(user.id, 'lead_email', String(body.lead_id), action, summary);
      return jsonResponse(201, { ok: true, data: { email: data } });
    }

    // ── PATCH EMAIL ───────────────────────────────────────────────────────────
    if (op === 'email' && id && method === 'PATCH') {
      if (user.role === 'pt_admin') return forbidden();
      let body: Record<string, unknown> = {};
      try { body = await req.json(); } catch { /* */ }
      const allowed = ['status','body','sentiment','sent_at'];
      const patch: Record<string, unknown> = {};
      for (const k of allowed) if (Object.prototype.hasOwnProperty.call(body, k)) patch[k] = body[k];
      const { data, error } = await db()
        .from('ps2_lead_emails').update(patch).eq('id', id).select('*').single();
      if (error) throw error;
      if (!data) return jsonResponse(404, { ok: false, error: 'Email not found' });
      if (patch.status === 'approved') {
        await logActivity(user.id, 'lead_email', data.lead_id, 'draft_approved', 'AI draft approved for sending');
      }
      return jsonResponse(200, { ok: true, data: { email: data } });
    }

    // ── MAIL CONFIG ───────────────────────────────────────────────────────────
    if (op === 'mail-config' && method === 'GET') {
      const { data, error } = await db()
        .from('ps2_mail_sequence_config').select('*')
        .eq('organization_id', ORG_ID).order('step_number');
      if (error) throw error;
      return jsonResponse(200, { ok: true, data: data || [] });
    }

    if (op === 'mail-config' && method === 'PATCH') {
      if (user.role !== 'sahasra_admin') return forbidden('Only sahasra_admin can edit mail config');
      let body: Record<string, unknown> = {};
      try { body = await req.json(); } catch { /* */ }
      const { step_number, ...updates } = body;
      if (!step_number) return jsonResponse(400, { ok: false, error: 'step_number required' });
      const allowed = ['label','day_offset','subject_template','body_template','is_active'];
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const k of allowed) if (Object.prototype.hasOwnProperty.call(updates, k)) patch[k] = updates[k];
      const { data, error } = await db()
        .from('ps2_mail_sequence_config').update(patch)
        .eq('organization_id', ORG_ID).eq('step_number', step_number).select('*').single();
      if (error) throw error;
      return jsonResponse(200, { ok: true, data });
    }

    // ── USERS ─────────────────────────────────────────────────────────────────

  return null;
}
