/**
 * Harshul dashboard — data layer (v4).
 *   • Reads AI_Config, Sheet1, Messages, Employees via gviz JSONP.
 *   • Applies AI_Config mapping to Sheet1.
 *   • Groups Messages by customer into the 5-step journey.
 *   • Falls back to demo fixtures when the sheet can't be read.
 *   • Posts the 3 dashboard writes to n8n webhooks.
 * Loaded after config/util/demo.
 */
(function (global) {
  'use strict';
  var CFG = global.HRS, U = global.HRSUtil;

  // ── n8n webhook trigger ─────────────────────────────────────
  async function triggerWorkflow(key, body) {
    var path = CFG.WEBHOOKS[key] || key;
    var url = CFG.N8N_BASE + '/' + path;
    var headers = { 'Content-Type': 'application/json' };
    if (CFG.N8N_API_KEY) headers['x-api-key'] = CFG.N8N_API_KEY;
    var res;
    try {
      res = await fetch(url, { method: 'POST', headers: headers, body: JSON.stringify(body || {}) });
    } catch (_) { return { ok: false, status: 0, data: { error: 'Network error — is the workflow active?' } }; }
    var data = {};
    try { data = await res.json(); } catch (_) {
      try { data = { raw: await res.text() }; } catch (_) { data = {}; }
    }
    var ackOnly = !!(data && data.message && /workflow was started|not registered/i.test(String(data.message)));
    return { ok: res.ok && !ackOnly, status: res.status, data: data, ackOnly: ackOnly };
  }

  // ── gviz JSONP reader ───────────────────────────────────────
  var _seq = 0;
  function gvizTab(tab) {
    return new Promise(function (resolve, reject) {
      var cb = '__hrs_gviz_' + (++_seq) + '_' + Date.now();
      var s;
      var timer = setTimeout(function () { cleanup(); reject(new Error('gviz timeout')); }, 12000);
      function cleanup() {
        clearTimeout(timer);
        try { delete global[cb]; } catch (_) { global[cb] = undefined; }
        if (s && s.parentNode) s.parentNode.removeChild(s);
      }
      global[cb] = function (resp) {
        cleanup();
        if (resp && resp.table) resolve(resp.table); else reject(new Error('no table'));
      };
      var url = 'https://docs.google.com/spreadsheets/d/' + encodeURIComponent(CFG.SHEET_ID) +
        '/gviz/tq?tqx=out:json;responseHandler:' + cb + '&sheet=' + encodeURIComponent(tab) + '&headers=1&_=' + Date.now();
      s = document.createElement('script');
      s.src = url;
      s.onerror = function () { cleanup(); reject(new Error('gviz load error')); };
      document.head.appendChild(s);
    });
  }
  function tableToGrid(table) {
    var headers = (table.cols || []).map(function (c) { return String((c && c.label) || '').trim(); });
    var hasLabels = headers.some(function (h) { return h; });
    var rows = (table.rows || []).map(function (r) {
      return (r.c || []).map(function (cell) {
        if (!cell) return '';
        return cell.f != null ? cell.f : (cell.v != null ? cell.v : '');
      });
    });
    if (!hasLabels) headers = (rows.shift() || []).map(String);
    return { headers: headers, rows: rows };
  }
  function idxOf(headers, name) {
    var t = String(name || '').trim().toLowerCase();
    for (var i = 0; i < headers.length; i++) if (String(headers[i]).trim().toLowerCase() === t) return i;
    return -1;
  }
  function pick(headers, names) {
    for (var i = 0; i < names.length; i++) { var j = idxOf(headers, names[i]); if (j >= 0) return j; }
    return -1;
  }

  // ── AI_Config mapping ───────────────────────────────────────
  async function getMapping() {
    var grid = tableToGrid(await gvizTab(CFG.TABS.config));
    var stdIdx = idxOf(grid.headers, 'standard_field'), actIdx = idxOf(grid.headers, 'actual_column');
    if (stdIdx < 0 || actIdx < 0) { stdIdx = 0; actIdx = 1; }
    var map = {};
    grid.rows.forEach(function (r) {
      var std = String(r[stdIdx] || '').trim().toLowerCase().replace(/\s+/g, '_');
      var act = String(r[actIdx] || '').trim();
      if (std && act) map[std] = act;
    });
    return map;
  }
  function applyMapping(grid, map) {
    var idx = {};
    CFG.STANDARD_FIELDS.forEach(function (f) {
      var i = map[f] ? idxOf(grid.headers, map[f]) : -1;
      if (i < 0) i = idxOf(grid.headers, f.replace(/_/g, ' '));
      if (i < 0) i = idxOf(grid.headers, f);
      idx[f] = i;
    });
    return grid.rows.map(function (r) {
      var o = { _raw: r };
      CFG.STANDARD_FIELDS.forEach(function (f) { o[f] = idx[f] >= 0 ? String(r[idx[f]] == null ? '' : r[idx[f]]).trim() : ''; });
      return o;
    }).filter(function (o) { return o.customer_name || o.phone; });
  }

  // ── Messages tab (English headers) ──────────────────────────
  function parseMessages(grid) {
    var h = grid.headers;
    var col = {
      phone: pick(h, ['customer_phone', 'phone', 'mobile']),
      name: pick(h, ['customer_name', 'name']),
      type: pick(h, ['message_type', 'type', 'stage']),
      sched: pick(h, ['scheduled_date', 'schedule_date', 'scheduled']),
      status: pick(h, ['status']),
      sent: pick(h, ['sent_date', 'sent_at', 'sent']),
      product: pick(h, ['product']),
      pattern: pick(h, ['upsell_pattern', 'pattern']),
      custom: pick(h, ['upsell_custom_message', 'upsell_message', 'custom_message']),
    };
    return grid.rows.map(function (r) {
      function g(i) { return i >= 0 ? String(r[i] == null ? '' : r[i]).trim() : ''; }
      return {
        customer_phone: g(col.phone), customer_name: g(col.name), message_type: g(col.type).toLowerCase().replace(/[\s-]+/g, '_'),
        scheduled_date: g(col.sched), status: (g(col.status) || 'pending').toLowerCase().replace(/[\s-]+/g, '_'),
        sent_date: g(col.sent), product: g(col.product),
        upsell_pattern: (g(col.pattern) || 'default').toLowerCase(), upsell_custom_message: g(col.custom),
      };
    }).filter(function (m) { return m.customer_phone && m.message_type; });
  }

  // ── Load everything (with demo fallback) ────────────────────
  var _state = { demo: false, reason: '' };
  async function loadAll() {
    try {
      var map = {};
      try { map = await getMapping(); } catch (_) { map = {}; }
      var clients = applyMapping(tableToGrid(await gvizTab(CFG.TABS.clients)), map);
      if (!clients.length) throw new Error('no client rows');
      var messages = [];
      try { messages = parseMessages(tableToGrid(await gvizTab(CFG.TABS.messages))); } catch (_) { messages = []; }
      var employees = [];
      try {
        var eg = tableToGrid(await gvizTab(CFG.TABS.employees));
        var ni = pick(eg.headers, ['name', 'employee']), pi = pick(eg.headers, ['phone', 'mobile', 'number']);
        employees = eg.rows.map(function (r) { return { name: ni >= 0 ? r[ni] : '', phone: pi >= 0 ? r[pi] : '' }; })
          .filter(function (e) { return e.name; });
      } catch (_) { employees = []; }
      _state.demo = false;
      return { clients: clients, messages: messages, employees: employees, mapping: map, demo: false };
    } catch (e) {
      _state.demo = true; _state.reason = e.message || 'read failed';
      var d = global.HRSDemo;
      var cd = d.clients();
      return { clients: cd.clients, messages: d.messages(), employees: d.employees(), mapping: cd.mapping, demo: true };
    }
  }

  // ── Derived helpers ─────────────────────────────────────────
  function sentDayKey(v) {
    if (!v) return '';
    return String(v).indexOf('T') >= 0 ? U.istKey(new Date(v)) : U.parseDateKey(v);
  }
  function computeHomeStats(clients, messages) {
    var today = U.todayKey();
    var sentToday = messages.filter(function (m) { return m.status === 'sent' && sentDayKey(m.sent_date) === today; }).length;
    var dueToday = 0, overdue = 0;
    clients.forEach(function (c) {
      if (U.isClosedStage(c.status)) return;
      var k = U.parseDateKey(c.follow_up_date);
      if (!k) return;
      if (k === today) dueToday++;
      else if (U.dayDiff(today, k) > 0) overdue++;
    });
    return { sentToday: sentToday, dueToday: dueToday, overdue: overdue };
  }

  // Counts per stage across the master sheet, in pipeline order.
  function computeStageStats(clients) {
    var counts = {};
    CFG.STAGES.forEach(function (s) { counts[s] = 0; });
    (clients || []).forEach(function (c) {
      var s = U.normStatus(c.status);
      if (counts[s] == null) counts[s] = 0;
      counts[s]++;
    });
    return CFG.STAGES.map(function (s) { return { stage: s, count: counts[s] || 0 }; });
  }

  // Employee leaderboard: deals closed (status === deal_closed) + total leads handled.
  function computeLeaderboard(clients) {
    var by = {};
    (clients || []).forEach(function (c) {
      var name = String(c.assigned_to || '').trim() || 'Unassigned';
      if (!by[name]) by[name] = { employee: name, dealsClosed: 0, total: 0 };
      by[name].total++;
      if (U.normStatus(c.status) === 'deal_closed') by[name].dealsClosed++;
    });
    return Object.keys(by).map(function (k) { return by[k]; })
      .sort(function (a, b) {
        if (b.dealsClosed !== a.dealsClosed) return b.dealsClosed - a.dealsClosed;
        return b.total - a.total;
      });
  }

  function stageMeta(key) {
    for (var i = 0; i < CFG.MESSAGE_STAGES.length; i++) if (CFG.MESSAGE_STAGES[i].key === key) return CFG.MESSAGE_STAGES[i];
    return null;
  }
  function buildActivity(clients, messages) {
    var items = [];
    messages.filter(function (m) { return m.status === 'sent' && m.sent_date; }).forEach(function (m) {
      var st = stageMeta(m.message_type);
      items.push({
        icon: '✅', tone: 'green', ts: m.sent_date,
        text: 'Day ' + (st ? st.day : '?') + ' ' + (st ? st.label : m.message_type) + ' message sent to ' + (m.customer_name || U.fmtPhone(m.customer_phone)),
      });
    });
    var today = U.todayKey();
    clients.forEach(function (c) {
      if (U.isClosedStage(c.status)) return;
      var k = U.parseDateKey(c.follow_up_date); if (!k) return;
      var d = U.dayDiff(today, k);
      if (d >= 7) items.push({ icon: '🚨', tone: 'red', ts: today + 'T09:00:00+05:30', text: 'Escalation: ' + (c.customer_name || '') + ' overdue ' + d + ' days' });
    });
    // Local user actions (mark done / upsell / reminders).
    U.getLocalActivity().forEach(function (a) { items.push({ icon: a.icon || '•', tone: a.tone || '', ts: a.ts, text: a.text }); });
    items.sort(function (a, b) { return new Date(b.ts) - new Date(a.ts); });
    return items.slice(0, 10);
  }

  function groupMessages(clients, messages) {
    var byPhone = {};
    clients.forEach(function (c) {
      var p = U.normPhone(c.phone);
      byPhone[p] = { phone: p, name: c.customer_name, product: c.product, sale_date: c.sale_date,
        stages: {}, upsell_pattern: 'default', upsell_custom_message: '' };
    });
    messages.forEach(function (m) {
      var p = U.normPhone(m.customer_phone);
      if (!byPhone[p]) byPhone[p] = { phone: p, name: m.customer_name, product: m.product, sale_date: '', stages: {}, upsell_pattern: 'default', upsell_custom_message: '' };
      var g = byPhone[p];
      g.stages[m.message_type] = m;
      if (!g.product && m.product) g.product = m.product;
      if (!g.name && m.customer_name) g.name = m.customer_name;
      if (m.upsell_pattern === 'customised') g.upsell_pattern = 'customised';
      if (m.upsell_custom_message) g.upsell_custom_message = m.upsell_custom_message;
    });
    return Object.keys(byPhone).map(function (k) { return byPhone[k]; })
      .filter(function (g) { return Object.keys(g.stages).length; });
  }

  global.HRSApi = {
    triggerWorkflow: triggerWorkflow,
    loadAll: loadAll,
    computeHomeStats: computeHomeStats,
    computeStageStats: computeStageStats,
    computeLeaderboard: computeLeaderboard,
    buildActivity: buildActivity,
    groupMessages: groupMessages,
    stageMeta: stageMeta,
    sentDayKey: sentDayKey,
    state: _state,
  };
})(window);
