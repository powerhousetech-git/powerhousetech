import {
  db, ORG_ID, N8N_ACTOR, jsonResponse, forbidden,
  SENT_STATUSES, FOLLOW_UP_STATUSES, MAIL1_OR_LATER,
  logActivity, getWebhooks, getN8nApiKey, fireN8n, leadRowFromBody,
  type SessionUser,
} from './helpers.ts';

export async function handleLeadReadOps(
  req: Request, op: string, id: string, method: string, user: SessionUser, isN8n: boolean,
): Promise<Response | null> {
  const url = new URL(req.url);



    // ── ME ──────────────────────────────────────────────────────────────────
    if (op === 'me' && method === 'GET') {
      return jsonResponse(200, { ok: true, user });
    }

    // ── DASHBOARD STATS ─────────────────────────────────────────────────────
    if (op === 'stats' && method === 'GET') {
      const { data: leads } = await db()
        .from('ps2_leads').select('status').eq('organization_id', ORG_ID);
      const all = leads || [];
      const total = all.length;
      const byStatus = Object.fromEntries(
        ['new','mail_1_sent','responded','meeting_scheduled','converted','discarded']
          .map(s => [s, all.filter(l => l.status === s).length])
      );
      const sent = all.filter(l => SENT_STATUSES.includes(l.status)).length;
      const { data: projects } = await db()
        .from('ps2_client_projects').select('stage').eq('organization_id', ORG_ID);
      const { data: emails } = await db()
        .from('ps2_lead_emails').select('sequence_step, status, direction, lead_id');
      const sentOut = (emails || []).filter(e => e.direction === 'outbound' && e.status === 'sent');
      const mail1FromEmail = new Set(sentOut.filter(e => e.sequence_step === 1).map(e => e.lead_id)).size;
      const followFromEmail = sentOut.filter(e => (e.sequence_step || 0) >= 2).length;
      const inboundCount = (emails || []).filter(e => e.direction === 'inbound').length;
      const mail1FromStatus = all.filter(l => MAIL1_OR_LATER.includes(l.status)).length;
      const followFromStatus = all.filter(l => FOLLOW_UP_STATUSES.includes(l.status)).length;
      const responsesFromStatus = (byStatus['responded'] || 0)
        + (byStatus['meeting_scheduled'] || 0)
        + (byStatus['converted'] || 0);
      const contacted = all.filter(l => l.status !== 'new').length;
      const converted = byStatus['converted'] || 0;
      const conversionRate = contacted > 0
        ? Math.round((converted / contacted) * 1000) / 10
        : 0;
      return jsonResponse(200, {
        ok: true,
        data: {
          total_leads: total,
          new_leads: byStatus['new'] || 0,
          sent_leads: sent,
          mail_1_sent: mail1FromEmail || mail1FromStatus,
          follow_ups_sent: followFromEmail || followFromStatus,
          responded_leads: inboundCount || (byStatus['responded'] || 0),
          responses: inboundCount || responsesFromStatus,
          meetings_scheduled: byStatus['meeting_scheduled'] || 0,
          converted_leads: converted,
          discarded_leads: byStatus['discarded'] || 0,
          contacted_leads: contacted,
          conversion_rate: conversionRate,
          active_projects: (projects || []).filter(p => !['completed','on_hold'].includes(p.stage)).length,
          funnel: [
            { status: 'new', label: 'New', count: byStatus['new'] || 0 },
            { status: 'sent', label: 'Mail 1 / Follow-up', count: (mail1FromEmail || mail1FromStatus) },
            { status: 'responded', label: 'Responded', count: inboundCount || responsesFromStatus },
            { status: 'meeting', label: 'Meeting', count: byStatus['meeting_scheduled'] || 0 },
            { status: 'converted', label: 'Converted', count: converted },
          ],
        },
      });
    }

    // ── ACTIVITY ─────────────────────────────────────────────────────────────
    if (op === 'activity' && method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const { data } = await db()
        .from('ps2_activity_log')
        .select('*')
        .eq('organization_id', ORG_ID)
        .order('created_at', { ascending: false })
        .limit(limit);
      return jsonResponse(200, { ok: true, data: data || [] });
    }

    // ── LEADS LIST ───────────────────────────────────────────────────────────
    if (op === 'leads' && method === 'GET') {
      const status = url.searchParams.get('status');
      const source = url.searchParams.get('source');
      const assignedTo = url.searchParams.get('assigned_to');
      const search = url.searchParams.get('search');
      const page = parseInt(url.searchParams.get('page') || '1');
      const pageSize = parseInt(url.searchParams.get('pageSize') || '50');

      let q = db().from('ps2_leads').select('*, ps2_users!assigned_to(full_name, outlook_account)', { count: 'exact' })
        .eq('organization_id', ORG_ID)
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (status) q = q.eq('status', status);
      if (source) q = q.eq('source', source);
      if (assignedTo) q = q.eq('assigned_to', assignedTo);
      if (search) q = q.or(`full_name.ilike.%${search}%,company.ilike.%${search}%,email.ilike.%${search}%`);

      const { data, count, error } = await q;
      if (error) throw error;
      return jsonResponse(200, { ok: true, data: { leads: data || [], total: count || 0, page, pageSize } });
    }

    // ── LEADS READY TO SEND (n8n workflow A) ─────────────────────────────────
    if (op === 'leads-ready-to-send' && method === 'GET') {
      // Get active mail config steps
      const { data: steps } = await db()
        .from('ps2_mail_sequence_config')
        .select('*')
        .eq('organization_id', ORG_ID)
        .eq('is_active', true)
        .order('step_number');

      const now = new Date();
      const { data: leads } = await db()
        .from('ps2_leads')
        .select('*, ps2_users!assigned_to(full_name, outlook_account)')
        .eq('organization_id', ORG_ID)
        .not('status', 'in', '("responded","meeting_scheduled","converted","discarded")')
        .not('email', 'is', null);

      const ready = (leads || []).filter(lead => {
        const lastActivity = lead.last_activity_at ? new Date(lead.last_activity_at) : new Date(lead.created_at);
        const daysSince = (now.getTime() - lastActivity.getTime()) / 86400000;

        if (lead.status === 'new') return true; // Ready for mail 1

        // Find current step number
        const statusToStep: Record<string, number> = { mail_1_sent: 1 };
        for (let i = 1; i <= 10; i++) statusToStep[`follow_up_${i}`] = i + 1;
        const currentStepNum = statusToStep[lead.status];
        if (!currentStepNum) return false;

        const nextStep = (steps || []).find(s => s.step_number === currentStepNum + 1);
        if (!nextStep) return false;
        return daysSince >= nextStep.day_offset;
      });

      // Attach the template for the next step
      const enriched = ready.map(lead => {
        let nextStepNum = 1;
        if (lead.status !== 'new') {
          const statusToStep: Record<string, number> = { mail_1_sent: 1 };
          for (let i = 1; i <= 10; i++) statusToStep[`follow_up_${i}`] = i + 1;
          nextStepNum = (statusToStep[lead.status] || 0) + 1;
        }
        const step = (steps || []).find(s => s.step_number === nextStepNum);
        return {
          ...lead,
          next_step: step || null,
          assigned_outlook: (lead as Record<string,unknown>)['ps2_users']
            ? ((lead as Record<string,unknown>)['ps2_users'] as Record<string,unknown>)['outlook_account']
            : null,
        };
      });

      return jsonResponse(200, { ok: true, data: { leads: enriched, total: enriched.length } });
    }

    // ── SINGLE LEAD ──────────────────────────────────────────────────────────
    if (op === 'lead' && id && method === 'GET') {
      const { data, error } = await db()
        .from('ps2_leads').select('*').eq('id', id).eq('organization_id', ORG_ID).maybeSingle();
      if (error) throw error;
      if (!data) return jsonResponse(404, { ok: false, error: 'Lead not found' });
      return jsonResponse(200, { ok: true, data: { lead: data } });
    }

    if (op === 'lead-by-email' && method === 'GET') {
      const email = (url.searchParams.get('email') || '').trim().toLowerCase();
      if (!email) return jsonResponse(400, { ok: false, error: 'email required' });
      const { data, error } = await db()
        .from('ps2_leads').select('*').eq('organization_id', ORG_ID).ilike('email', email).maybeSingle();
      if (error) throw error;
      if (!data) return jsonResponse(404, { ok: false, error: 'Lead not found' });
      return jsonResponse(200, { ok: true, data: { lead: data } });
    }

    // ── CREATE LEAD ──────────────────────────────────────────────────────────

  return null;
}
