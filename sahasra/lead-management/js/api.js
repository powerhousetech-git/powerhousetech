(function (global) {
  'use strict';

  var API = global.PS2.API;
  var TOKEN_KEY = global.PS2.TOKEN_KEY;
  var N8N_BASE = global.PS2.N8N_BASE;
  var N8N_API_KEY = global.PS2.N8N_API_KEY;
  var N8N_WEBHOOKS = global.PS2.N8N_WEBHOOKS;

  function getToken() {
    try { return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY); } catch (_) { return null; }
  }
  function setToken(t) {
    try { sessionStorage.setItem(TOKEN_KEY, t); localStorage.setItem(TOKEN_KEY, t); } catch (_) {}
  }
  function clearToken() {
    try { sessionStorage.removeItem(TOKEN_KEY); localStorage.removeItem(TOKEN_KEY); } catch (_) {}
  }

  async function req(method, op, body, params) {
    var url = API + '?op=' + op;
    if (params) url += '&' + params;
    var headers = { 'Content-Type': 'application/json' };
    var t = getToken();
    if (t) headers['Authorization'] = 'Bearer ' + t;
    var opts = { method: method, headers: headers };
    if (body != null) opts.body = JSON.stringify(body);
    var res = await fetch(url, opts);
    var data = {};
    try { data = await res.json(); } catch (_) {}
    return { ok: res.ok, status: res.status, data: data };
  }

  /** Direct portal → n8n webhook (Option B sheet writes). Dual auth headers for handshake compat. */
  async function n8nWebhook(pathOrUrl, body) {
    var url = pathOrUrl;
    if (url && url.indexOf('http') !== 0) url = N8N_BASE + url;
    if (!url) return { ok: false, status: 0, data: { error: 'Webhook URL missing' } };
    var headers = {
      'Content-Type': 'application/json',
      'x-api-key': N8N_API_KEY,
      'Shreyas09': N8N_API_KEY,
    };
    var res;
    try {
      res = await fetch(url, { method: 'POST', headers: headers, body: JSON.stringify(body || {}) });
    } catch (err) {
      return { ok: false, status: 0, data: { error: 'Network error calling n8n' } };
    }
    var data = {};
    try { data = await res.json(); } catch (_) {
      try { data = { raw: await res.text() }; } catch (_) { data = {}; }
    }
    return { ok: res.ok, status: res.status, data: data };
  }

  function webhookPath(key) {
    return (N8N_WEBHOOKS && N8N_WEBHOOKS[key]) || '';
  }

  /** Map portal lead fields → sheet column payload (email is identity). */
  function toSheetPayload(lead, extra) {
    lead = lead || {};
    var name = lead.name || lead.full_name || '';
    var out = {
      name: name,
      full_name: name,
      email: lead.email || '',
      phone: lead.phone || '',
      company: lead.company || '',
      designation: lead.designation || '',
      website: lead.website || '',
      source: lead.source || 'manual',
      status: lead.status || 'new',
      notes: lead.notes || '',
      follow_up_count: lead.follow_up_count != null ? lead.follow_up_count : undefined,
    };
    if (extra) Object.keys(extra).forEach(function (k) { out[k] = extra[k]; });
    Object.keys(out).forEach(function (k) { if (out[k] === undefined) delete out[k]; });
    return out;
  }

  global.PS2Api = {
    getToken: getToken,
    setToken: setToken,
    clearToken: clearToken,
    n8nWebhook: n8nWebhook,
    toSheetPayload: toSheetPayload,

    login: function (u, p) { return req('POST', 'login', { username: u, password: p }); },
    me: function () { return req('GET', 'me'); },

    // Dashboard / activity (Supabase support DB)
    stats: function () { return req('GET', 'stats'); },
    activity: function (limit) { return req('GET', 'activity', null, 'limit=' + (limit || 20)); },

    // v6 master sheet reads (Edge proxies public CSV — avoids browser CORS)
    sheetLeads: function () { return req('GET', 'sheet-leads'); },
    health: function () { return req('GET', 'health'); },

    // Portal org settings (booking link etc.) — sahasra_admin allowed
    portalSettings: function () { return req('GET', 'portal-settings'); },
    patchPortalSettings: function (body) { return req('PATCH', 'portal-settings', body); },

    // Sheet writes via n8n
    addLeadToSheet: function (lead) {
      return n8nWebhook(webhookPath('add_lead'), toSheetPayload(lead, { action: 'create', event: 'lead.create' }));
    },
    updateLeadInSheet: function (lead) {
      var payload = toSheetPayload(lead, { action: 'update', event: 'lead.update' });
      if (!payload.email) return Promise.resolve({ ok: false, status: 400, data: { error: 'email required to update sheet row' } });
      return n8nWebhook(webhookPath('update_lead'), payload);
    },
    enrichWebsite: function (email, website) {
      return n8nWebhook(webhookPath('enrich_website'), {
        event: 'lead.created',
        email: email,
        website: website,
      });
    },
    triggerN8nDirect: function (workflowKey, payload) {
      var path = webhookPath(workflowKey);
      return n8nWebhook(path, payload || {
        event: 'portal.trigger',
        workflow: workflowKey,
        triggered_at: new Date().toISOString(),
      });
    },

    // Legacy Supabase lead ops (kept for transitional / attachment flows — prefer sheet methods)
    listLeads: function (params) { return req('GET', 'leads', null, params || ''); },
    getLead: function (id) { return req('GET', 'lead', null, 'id=' + id); },
    createLead: function (body) { return req('POST', 'lead', body); },
    patchLead: function (id, body) { return req('PATCH', 'lead', body, 'id=' + id); },
    deleteLead: function (id) { return req('DELETE', 'lead', null, 'id=' + id); },
    bulkLeads: function (body) { return req('POST', 'leads-bulk', body); },
    importLeads: function (body) { return req('POST', 'leads-import', body); },
    ingestFile: function (body) { return req('POST', 'ingest-file', body); },
    uploadBatches: function () { return req('GET', 'upload-batches'); },
    triggerN8n: function (body) { return req('POST', 'trigger-n8n', body); },
    attachLeadFile: function (body) { return req('POST', 'lead-attachment', body); },
    leadsReadyToSend: function () { return req('GET', 'leads-ready-to-send'); },
    convertLead: function (id, body) { return req('POST', 'lead-convert', body, 'id=' + id); },

    // Emails / drafts (Supabase)
    listEmails: function (leadId, status) {
      return req('GET', 'emails', null, [leadId ? 'lead_id=' + leadId : '', status ? 'status=' + status : ''].filter(Boolean).join('&'));
    },
    createEmail: function (body) { return req('POST', 'email', body); },
    patchEmail: function (id, body) { return req('PATCH', 'email', body, 'id=' + id); },
    reviewDrafts: function (assignedTo) {
      return req('GET', 'review-drafts', null, assignedTo ? 'assigned_to=' + assignedTo : '');
    },

    // Mail config
    mailConfig: function () { return req('GET', 'mail-config'); },
    patchMailConfig: function (body) { return req('PATCH', 'mail-config', body); },

    // Projects
    listProjects: function () { return req('GET', 'projects'); },
    getProject: function (id) { return req('GET', 'project', null, 'id=' + id); },
    createProject: function (body) { return req('POST', 'project', body); },
    patchProject: function (id, body) { return req('PATCH', 'project', body, 'id=' + id); },
    advanceProject: function (id, body) { return req('POST', 'project-advance', body, 'id=' + id); },

    // Users
    listUsers: function () { return req('GET', 'users'); },
    createUser: function (body) { return req('POST', 'user', body); },
    patchUser: function (id, body) { return req('PATCH', 'user', body, 'id=' + id); },
    deleteUser: function (id) { return req('DELETE', 'user', null, 'id=' + id); },

    // Settings
    outlookAccounts: function () { return req('GET', 'outlook-accounts'); },
    sheetConnections: function () { return req('GET', 'sheet-connections'); },
    createSheetConnection: function (body) { return req('POST', 'sheet-connection', body); },
    patchSheetConnection: function (id, body) { return req('PATCH', 'sheet-connection', body, 'id=' + id); },
    getSettings: function () { return req('GET', 'settings'); },
    patchSettings: function (body) { return req('PATCH', 'settings', body); },
  };
})(window);
