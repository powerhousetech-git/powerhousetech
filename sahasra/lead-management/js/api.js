(function (global) {
  'use strict';

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

  /** Direct portal → n8n webhook. Dual auth headers for handshake compat. */
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
    var ackOnly = !!(data && data.message && /workflow was started/i.test(String(data.message)));
    return { ok: res.ok, status: res.status, data: data, ackOnly: ackOnly };
  }

  function requireWriteConfirm(res, label) {
    if (res && res.ackOnly) {
      return {
        ok: false,
        status: res.status,
        ackOnly: true,
        data: {
          error: (label || 'n8n write') + ' acknowledged but did not confirm sheet write — set Respond to Webhook after Sheets append',
          message: res.data && res.data.message,
        },
      };
    }
    return res;
  }

  function webhookPath(key) {
    return (N8N_WEBHOOKS && N8N_WEBHOOKS[key]) || '';
  }

  /** Map portal lead fields → sheet column payload (email is identity). */
  function toSheetPayload(lead, extra) {
    lead = lead || {};
    var name = lead.name || lead.full_name || '';
    var region = String(lead.region || lead.Region || 'IN').toUpperCase();
    if (region !== 'US') region = 'IN';
    var batch = lead.batch || lead.Batch || '';
    var triggered = lead.batch_triggered_at || lead['Batch Triggered At'] || '';
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
      batch: batch || undefined,
      Batch: batch || undefined,
      region: region,
      Region: region,
    };
    if (triggered) {
      out.batch_triggered_at = triggered;
      out['Batch Triggered At'] = triggered;
    }
    if (extra) Object.keys(extra).forEach(function (k) { out[k] = extra[k]; });
    Object.keys(out).forEach(function (k) { if (out[k] === undefined) delete out[k]; });
    return out;
  }

  /** Read from n8n Portal Data API — replaces all Supabase reads */
  async function portalData(op) {
    var path = (N8N_WEBHOOKS.portal_data || '/webhook/ps2-portal-data');
    var headers = {
      'Content-Type': 'application/json',
      'x-api-key': N8N_API_KEY,
      'Shreyas09': N8N_API_KEY,
    };
    async function call(method) {
      var url = N8N_BASE + path + (method === 'GET' ? ('?op=' + encodeURIComponent(op)) : '');
      var opts = { method: method, headers: headers };
      if (method === 'POST') opts.body = JSON.stringify({ op: op, event: 'portal.data' });
      var res;
      try { res = await fetch(url, opts); }
      catch (err) { return { ok: false, status: 0, data: { error: 'Network error' } }; }
      var data;
      try { data = await res.json(); } catch (_) { data = []; }
      return { ok: res.ok, status: res.status, data: data };
    }
    var result = await call('GET');
    // Some n8n webhooks are POST-only or "respond immediately" on GET — retry POST
    var d = result.data;
    if (!result.ok || (d && d.message && /workflow was started/i.test(String(d.message))) || (d && d.error)) {
      var post = await call('POST');
      if (post.ok && !(post.data && post.data.message && /workflow was started/i.test(String(post.data.message)))) {
        return post;
      }
      // Prefer POST body if GET only returned ack
      if (Array.isArray(post.data) || (post.data && Array.isArray(post.data.leads))) return post;
    }
    return result;
  }

  global.PS2Api = {
    getToken: getToken,
    setToken: setToken,
    clearToken: clearToken,
    n8nWebhook: n8nWebhook,
    toSheetPayload: toSheetPayload,
    portalData: portalData,

    // ─── READS (n8n Portal Data API) ───
    sheetLeads: function () { return portalData('leads'); },
    mailConfig: function () { return portalData('mail-config'); },
    getSettings: function () { return portalData('settings'); },
    listEmails: function () { return portalData('email-log'); },
    portalSettings: function () { return portalData('settings'); },

    // ─── CARD OCR (n8n Claude vision) ───
    /** POST one page/image as { image_base64 } to /webhook/ps2-card-ocr */
    cardOcr: function (payload) {
      return n8nWebhook(webhookPath('card_ocr'), payload || {});
    },
    /** Alias used by Capture upload flow */
    ingestFile: function (payload) {
      return this.cardOcr(payload);
    },

    // ─── WRITES (n8n webhooks) ───
    addLeadToSheet: function (lead) {
      return n8nWebhook(webhookPath('add_lead'), toSheetPayload(lead, { action: 'create', event: 'lead.create' }))
        .then(function (res) { return requireWriteConfirm(res, 'ps2-add-lead'); });
    },
    updateLeadInSheet: function (lead) {
      var payload = toSheetPayload(lead, { action: 'update', event: 'lead.update' });
      if (!payload.email) return Promise.resolve({ ok: false, status: 400, data: { error: 'email required' } });
      return n8nWebhook(webhookPath('update_lead'), payload)
        .then(function (res) { return requireWriteConfirm(res, 'ps2-update-lead'); });
    },
    enrichWebsite: function (email, website) {
      return n8nWebhook(webhookPath('enrich_website'), { event: 'lead.created', email: email, website: website });
    },
    triggerN8nDirect: function (workflowKey, payload) {
      return n8nWebhook(webhookPath(workflowKey), payload || {
        event: 'portal.trigger',
        workflow: workflowKey,
        triggered_at: new Date().toISOString(),
      });
    },

    // ─── MAIL / SETTINGS WRITES ───
    patchMailConfig: function (body) {
      return n8nWebhook(webhookPath('update_lead'), Object.assign({ op: 'mail-config-update' }, body || {}));
    },
    patchSettings: function (body) {
      return n8nWebhook(webhookPath('update_lead'), Object.assign({ op: 'settings-update' }, body || {}));
    },
    patchPortalSettings: function (body) {
      return n8nWebhook(webhookPath('update_lead'), Object.assign({ op: 'settings-update' }, body || {}));
    },

    // Draft approve/reject → email log status via update webhook
    patchEmail: function (id, body) {
      return n8nWebhook(webhookPath('update_lead'), Object.assign({
        op: 'email-status-update',
        email_id: id,
      }, body || {}));
    },
  };
})(window);
