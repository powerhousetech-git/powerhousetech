(function (global) {
  'use strict';

  var API = global.PS2.API;
  var TOKEN_KEY = global.PS2.TOKEN_KEY;

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

  global.PS2Api = {
    getToken, setToken, clearToken,

    login: (u, p) => req('POST', 'login', { username: u, password: p }),
    me: () => req('GET', 'me'),

    // Dashboard
    stats: () => req('GET', 'stats'),
    activity: (limit) => req('GET', 'activity', null, 'limit=' + (limit || 20)),

    // Leads
    listLeads: (params) => req('GET', 'leads', null, params || ''),
    getLead: (id) => req('GET', 'lead', null, 'id=' + id),
    createLead: (body) => req('POST', 'lead', body),
    patchLead: (id, body) => req('PATCH', 'lead', body, 'id=' + id),
    deleteLead: (id) => req('DELETE', 'lead', null, 'id=' + id),
    bulkLeads: (body) => req('POST', 'leads-bulk', body),
    leadsReadyToSend: () => req('GET', 'leads-ready-to-send'),
    convertLead: (id, body) => req('POST', 'lead-convert', body, 'id=' + id),

    // Emails
    listEmails: (leadId, status) => req('GET', 'emails', null, [leadId ? 'lead_id=' + leadId : '', status ? 'status=' + status : ''].filter(Boolean).join('&')),
    createEmail: (body) => req('POST', 'email', body),
    patchEmail: (id, body) => req('PATCH', 'email', body, 'id=' + id),
    reviewDrafts: (assignedTo) => req('GET', 'review-drafts', null, assignedTo ? 'assigned_to=' + assignedTo : ''),

    // Mail config
    mailConfig: () => req('GET', 'mail-config'),
    patchMailConfig: (body) => req('PATCH', 'mail-config', body),

    // Projects
    listProjects: () => req('GET', 'projects'),
    getProject: (id) => req('GET', 'project', null, 'id=' + id),
    createProject: (body) => req('POST', 'project', body),
    patchProject: (id, body) => req('PATCH', 'project', body, 'id=' + id),
    advanceProject: (id, body) => req('POST', 'project-advance', body, 'id=' + id),

    // Users
    listUsers: () => req('GET', 'users'),
    createUser: (body) => req('POST', 'user', body),
    patchUser: (id, body) => req('PATCH', 'user', body, 'id=' + id),
    deleteUser: (id) => req('DELETE', 'user', null, 'id=' + id),

    // Settings
    outlookAccounts: () => req('GET', 'outlook-accounts'),
    sheetConnections: () => req('GET', 'sheet-connections'),
    createSheetConnection: (body) => req('POST', 'sheet-connection', body),
    patchSheetConnection: (id, body) => req('PATCH', 'sheet-connection', body, 'id=' + id),
    getSettings: () => req('GET', 'settings'),
    patchSettings: (body) => req('PATCH', 'settings', body),
  };
})(window);
