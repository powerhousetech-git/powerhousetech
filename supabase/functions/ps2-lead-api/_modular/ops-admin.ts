import {
  db, ORG_ID, N8N_ACTOR, jsonResponse, forbidden,
  SENT_STATUSES, FOLLOW_UP_STATUSES, MAIL1_OR_LATER,
  logActivity, getWebhooks, getN8nApiKey, fireN8n, leadRowFromBody,
  type SessionUser,
} from './helpers.ts';

export async function handleAdminOps(
  req: Request, op: string, id: string, method: string, user: SessionUser, isN8n: boolean,
): Promise<Response | null> {
    if (op === 'users' && method === 'GET') {
      if (user.role !== 'sahasra_admin') return forbidden();
      const { data, error } = await db()
        .from('ps2_users').select('id, username, full_name, role, outlook_account, is_active, created_at')
        .eq('organization_id', ORG_ID).order('created_at');
      if (error) throw error;
      return jsonResponse(200, { ok: true, data: data || [] });
    }

    if (op === 'user' && method === 'POST') {
      if (user.role !== 'sahasra_admin') return forbidden();
      let body: Record<string, unknown> = {};
      try { body = await req.json(); } catch { /* */ }
      const username = String(body.username || '').trim();
      const password = String(body.password || '');
      if (!username || !password) return jsonResponse(400, { ok: false, error: 'username and password required' });
      // Use pgcrypto for password hashing
      const { data, error } = await db().from('ps2_users').insert({
        organization_id: ORG_ID,
        username,
        password_hash: `placeholder_will_be_hashed`, // will be overwritten by RPC
        full_name: body.full_name || null,
        role: body.role || 'sahasra_employee',
        outlook_account: body.outlook_account || null,
      }).select('id, username, full_name, role, outlook_account, is_active').single();
      if (error) throw error;
      // Hash password via pgcrypto update
      await db().rpc('ps2_set_password', { p_user_id: data.id, p_password: password });
      return jsonResponse(201, { ok: true, data });
    }

    if (op === 'user' && id && method === 'PATCH') {
      if (user.role !== 'sahasra_admin') return forbidden();
      let body: Record<string, unknown> = {};
      try { body = await req.json(); } catch { /* */ }
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (body.full_name !== undefined) patch.full_name = body.full_name;
      if (body.role !== undefined) patch.role = body.role;
      if (body.outlook_account !== undefined) patch.outlook_account = body.outlook_account;
      if (body.is_active !== undefined) patch.is_active = body.is_active;
      const { data, error } = await db()
        .from('ps2_users').update(patch).eq('id', id).eq('organization_id', ORG_ID)
        .select('id, username, full_name, role, outlook_account, is_active').single();
      if (error) throw error;
      if (body.password) {
        await db().rpc('ps2_set_password', { p_user_id: id, p_password: String(body.password) });
      }
      return jsonResponse(200, { ok: true, data });
    }

    if (op === 'user' && id && method === 'DELETE') {
      if (user.role !== 'sahasra_admin') return forbidden();
      if (id === user.id) return forbidden('Cannot delete your own account');
      const { error } = await db()
        .from('ps2_users').update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id).eq('organization_id', ORG_ID);
      if (error) throw error;
      return jsonResponse(200, { ok: true });
    }

    // ── PROJECTS ─────────────────────────────────────────────────────────────
    if (op === 'projects' && method === 'GET') {
      const { data, error } = await db()
        .from('ps2_client_projects').select('*')
        .eq('organization_id', ORG_ID).order('created_at', { ascending: false });
      if (error) throw error;
      return jsonResponse(200, { ok: true, data: data || [] });
    }

    if (op === 'project' && id && method === 'GET') {
      const { data, error } = await db()
        .from('ps2_client_projects').select('*').eq('id', id).eq('organization_id', ORG_ID).maybeSingle();
      if (error) throw error;
      if (!data) return jsonResponse(404, { ok: false, error: 'Project not found' });
      const { data: transitions } = await db()
        .from('ps2_stage_transitions').select('*').eq('project_id', id).order('created_at');
      return jsonResponse(200, { ok: true, data: { project: data, transitions: transitions || [] } });
    }

    if (op === 'project' && method === 'POST') {
      if (user.role === 'pt_admin') return forbidden();
      let body: Record<string, unknown> = {};
      try { body = await req.json(); } catch { /* */ }
      if (!body.client_name || !body.project_name) return jsonResponse(400, { ok: false, error: 'client_name and project_name required' });
      const { data, error } = await db().from('ps2_client_projects').insert({
        organization_id: ORG_ID,
        lead_id: body.lead_id || null,
        client_name: body.client_name,
        project_name: body.project_name,
        order_value: body.order_value || null,
        stage: body.stage || 'enquiry_received',
        assigned_to: body.assigned_to || null,
        target_date: body.target_date || null,
        notes: body.notes || null,
        quotation_ref: body.quotation_ref || null,
        stage_entered_at: new Date().toISOString(),
      }).select('*').single();
      if (error) throw error;
      await logActivity(user.id, 'project', data.id, 'project_created', `New project: ${data.project_name} for ${data.client_name}`);
      return jsonResponse(201, { ok: true, data: { project: data } });
    }

    if (op === 'project' && id && method === 'PATCH') {
      if (user.role === 'pt_admin') return forbidden();
      let body: Record<string, unknown> = {};
      try { body = await req.json(); } catch { /* */ }
      const allowed = ['client_name','project_name','order_value','assigned_to','target_date','notes','quotation_ref'];
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const k of allowed) if (Object.prototype.hasOwnProperty.call(body, k)) patch[k] = body[k];
      const { data, error } = await db()
        .from('ps2_client_projects').update(patch).eq('id', id).eq('organization_id', ORG_ID).select('*').single();
      if (error) throw error;
      return jsonResponse(200, { ok: true, data: { project: data } });
    }

    if (op === 'project-advance' && id && method === 'POST') {
      if (user.role === 'pt_admin') return forbidden();
      let body: Record<string, unknown> = {};
      try { body = await req.json(); } catch { /* */ }
      if (!body.to_stage) return jsonResponse(400, { ok: false, error: 'to_stage required' });

      const { data: existing } = await db()
        .from('ps2_client_projects').select('stage').eq('id', id).maybeSingle();
      if (!existing) return jsonResponse(404, { ok: false, error: 'Project not found' });

      const { data, error } = await db()
        .from('ps2_client_projects').update({
          stage: body.to_stage,
          stage_entered_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', id).eq('organization_id', ORG_ID).select('*').single();
      if (error) throw error;

      await db().from('ps2_stage_transitions').insert({
        project_id: id,
        from_stage: existing.stage,
        to_stage: body.to_stage,
        notes: body.notes || null,
        transitioned_by: user.id,
      });
      await logActivity(user.id, 'project', id, 'stage_changed', `Project moved to ${body.to_stage}`);
      return jsonResponse(200, { ok: true, data: { project: data } });
    }

    // ── CONVERT LEAD → PROJECT ────────────────────────────────────────────────
    if (op === 'lead-convert' && id && method === 'POST') {
      if (user.role === 'pt_admin') return forbidden();
      let body: Record<string, unknown> = {};
      try { body = await req.json(); } catch { /* */ }
      const { data: lead } = await db()
        .from('ps2_leads').select('*').eq('id', id).eq('organization_id', ORG_ID).maybeSingle();
      if (!lead) return jsonResponse(404, { ok: false, error: 'Lead not found' });

      const { data: project, error } = await db().from('ps2_client_projects').insert({
        organization_id: ORG_ID,
        lead_id: id,
        client_name: body.client_name || lead.company || lead.full_name,
        project_name: body.project_name || `Project for ${lead.company || lead.full_name}`,
        order_value: body.order_value || null,
        stage: 'enquiry_received',
        assigned_to: lead.assigned_to,
        stage_entered_at: new Date().toISOString(),
      }).select('*').single();
      if (error) throw error;

      await db().from('ps2_leads').update({
        status: 'converted', updated_at: new Date().toISOString(), last_activity_at: new Date().toISOString(),
      }).eq('id', id);
      await logActivity(user.id, 'lead', id, 'lead_converted', `Lead converted → project ${project.id}`);
      return jsonResponse(201, { ok: true, data: { project } });
    }

    // ── GOOGLE SHEET CONNECTIONS ──────────────────────────────────────────────
    if (op === 'sheet-connections' && method === 'GET') {
      const { data, error } = await db()
        .from('ps2_google_sheet_connections').select('*')
        .eq('organization_id', ORG_ID).order('created_at');
      if (error) throw error;
      return jsonResponse(200, { ok: true, data: data || [] });
    }

    if (op === 'sheet-connection' && method === 'POST') {
      if (user.role === 'pt_admin') return forbidden();
      let body: Record<string, unknown> = {};
      try { body = await req.json(); } catch { /* */ }
      const sheetUrl = String(body.sheet_url || '').trim();
      if (!sheetUrl) return jsonResponse(400, { ok: false, error: 'sheet_url required' });
      const tabName = String(body.tab_name || 'Sheet1').trim() || 'Sheet1';
      const parsedFromUrl = String(sheetUrl).match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      const parsedId = String(body.sheet_id || '').trim() || (parsedFromUrl ? parsedFromUrl[1] : null);
      if (parsedId) {
        const { data: existing } = await db()
          .from('ps2_google_sheet_connections')
          .select('id, sheet_url, tab_name, sheet_id')
          .eq('organization_id', ORG_ID)
          .eq('sheet_id', parsedId)
          .eq('tab_name', tabName)
          .maybeSingle();
        if (existing) {
          return jsonResponse(409, {
            ok: false,
            error: 'Duplicate sheet — this Google Sheet + tab is already connected',
            data: { existing_id: existing.id },
          });
        }
      }
      const { data, error } = await db().from('ps2_google_sheet_connections').insert({
        organization_id: ORG_ID,
        sheet_url: sheetUrl,
        sheet_id: parsedId || null,
        tab_name: tabName,
        column_mapping: body.column_mapping || {},
        sync_interval_hours: body.sync_interval_hours || 24,
        is_active: true,
        created_by: user.id,
      }).select('*').single();
      if (error) throw error;
      return jsonResponse(201, { ok: true, data });
    }

    if (op === 'sheet-connection' && id && method === 'PATCH') {
      let body: Record<string, unknown> = {};
      try { body = await req.json(); } catch { /* */ }
      const allowed = ['sheet_id','tab_name','column_mapping','sync_interval_hours','is_active','last_synced_at','sheet_url'];
      const patch: Record<string, unknown> = {};
      for (const k of allowed) if (Object.prototype.hasOwnProperty.call(body, k)) patch[k] = body[k];
      const { data, error } = await db()
        .from('ps2_google_sheet_connections').update(patch).eq('id', id).eq('organization_id', ORG_ID).select('*').single();
      if (error) throw error;
      return jsonResponse(200, { ok: true, data });
    }

    if (op === 'sheet-connection' && id && method === 'DELETE') {
      if (user.role === 'pt_admin') return forbidden();
      const { error } = await db()
        .from('ps2_google_sheet_connections')
        .delete()
        .eq('id', id)
        .eq('organization_id', ORG_ID);
      if (error) throw error;
      await logActivity(user.id, 'system', id, 'sheet_connection_deleted', `Removed field-team sheet connection ${id}`);
      return jsonResponse(200, { ok: true, data: { id } });
    }

    // ── OUTLOOK ACCOUNTS ──────────────────────────────────────────────────────
    if (op === 'outlook-accounts' && method === 'GET') {
      const { data } = await db()
        .from('ps2_users')
        .select('id, full_name, outlook_account, is_active')
        .eq('organization_id', ORG_ID)
        .eq('is_active', true)
        .not('outlook_account', 'is', null);
      const accounts = (data || []).map(u => ({
        id: u.id,
        email: u.outlook_account,
        display_name: u.full_name,
        is_connected: true,
        user_id: u.id,
      }));
      return jsonResponse(200, { ok: true, data: accounts });
    }

    // ── SYSTEM SETTINGS ────────────────────────────────────────────────────────
    if (op === 'settings' && method === 'GET') {
      if (user.role !== 'pt_admin' && !isN8n) return forbidden('Only pt_admin can access system settings');
      const { data } = await db()
        .from('ps2_system_settings').select('*').eq('organization_id', ORG_ID);
      const rows = data || [];
      const get = (key: string) => rows.find(r => r.key === key)?.value ?? {};
      const webhooks = get('n8n_webhooks') as Record<string,string>;
      const dbKey = get('n8n_api_key') as Record<string,string> | string;
      const dbKeyStr = typeof dbKey === 'string' ? dbKey : (dbKey?.key || '');
      const keyConfigured = Boolean(Deno.env.get('N8N_API_KEY') || dbKeyStr);
      return jsonResponse(200, {
        ok: true,
        data: {
          ai_prompt_first_email: (get('ai_prompt_first_email') as Record<string,string>).prompt || '',
          ai_prompt_reply: (get('ai_prompt_reply') as Record<string,string>).prompt || '',
          ai_prompt_sentiment: (get('ai_prompt_sentiment') as Record<string,string>).prompt || '',
          n8n_webhooks: {
            send_email: webhooks?.send_email || '',
            sync_sheets: webhooks?.sync_sheets || '',
            process_replies: webhooks?.process_replies || '',
            enrich_website: webhooks?.enrich_website || '',
            extract_pdf: webhooks?.extract_pdf || '',
          },
          n8n_workflows: {
            send_email: '4LukaFFhxKQMceTf',
            process_replies: '3P7CsPNybLQfCVoB',
            sync_sheets: 'W0HLYxXT3BcFBARU',
            enrich_website: 'OEKnJlD68UwnFoPj',
          },
          health: {
            n8n_api_key_configured: keyConfigured,
            anthropic_key_configured: Boolean(Deno.env.get('ANTHROPIC_API_KEY')),
            supabase_service_key_configured: Boolean(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')),
          },
        },
      });
    }

    if (op === 'settings' && method === 'PATCH') {
      if (user.role !== 'pt_admin') return forbidden('Only pt_admin can edit system settings');
      let body: Record<string, unknown> = {};
      try { body = await req.json(); } catch { /* */ }
      const upsert = async (key: string, value: unknown) => {
        await db().from('ps2_system_settings').upsert(
          { organization_id: ORG_ID, key, value, updated_at: new Date().toISOString() },
          { onConflict: 'organization_id,key' }
        );
      };
      if (body.ai_prompt_first_email !== undefined) await upsert('ai_prompt_first_email', { prompt: body.ai_prompt_first_email });
      if (body.ai_prompt_reply !== undefined) await upsert('ai_prompt_reply', { prompt: body.ai_prompt_reply });
      if (body.ai_prompt_sentiment !== undefined) await upsert('ai_prompt_sentiment', { prompt: body.ai_prompt_sentiment });
      if (body.n8n_webhooks !== undefined) {
        const incoming = body.n8n_webhooks as Record<string, string>;
        const current = await getWebhooks();
        await upsert('n8n_webhooks', { ...current, ...incoming });
      }
      if (body.n8n_api_key) await upsert('n8n_api_key', { key: String(body.n8n_api_key) });
      return jsonResponse(200, { ok: true });
    }

    return jsonResponse(404, { ok: false, error: `Unknown op: ${op}` });


  
  return null;
}
