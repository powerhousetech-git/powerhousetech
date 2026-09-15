/**
 * Harshul dashboard — data layer.
 *   • Actions  → POST to n8n webhooks (Send Message, Digest, Follow-Up, Mark Done)
 *   • Reads    → Google Sheet via gviz JSONP (no backend, no CORS issue)
 *   • Mapping  → AI_Config (standard_field | actual_column) applied to Sheet1
 *   • Fallback → in-memory demo data when the sheet can't be read
 * Loaded after config.js + util.js.
 */
(function (global) {
  'use strict';

  var CFG = global.HRS;
  var U = global.HRSUtil;

  // ── n8n webhook trigger ─────────────────────────────────────
  async function triggerWorkflow(key, body) {
    var path = CFG.WEBHOOKS[key] || key;
    var url = CFG.N8N_BASE + '/' + path;
    var headers = { 'Content-Type': 'application/json' };
    if (CFG.N8N_API_KEY) headers['x-api-key'] = CFG.N8N_API_KEY;
    var res;
    try {
      res = await fetch(url, { method: 'POST', headers: headers, body: JSON.stringify(body || {}) });
    } catch (err) {
      return { ok: false, status: 0, data: { error: 'Network error — is the workflow active?' } };
    }
    var data = {};
    try { data = await res.json(); } catch (_) {
      try { data = { raw: await res.text() }; } catch (_) { data = {}; }
    }
    var ackOnly = !!(data && data.message && /workflow was started|not registered/i.test(String(data.message)));
    return { ok: res.ok && !ackOnly, status: res.status, data: data, ackOnly: ackOnly };
  }

  // ── gviz JSONP reader ───────────────────────────────────────
  var _cbSeq = 0;
  function gvizTab(tab) {
    return new Promise(function (resolve, reject) {
      var cbName = '__hrs_gviz_' + (++_cbSeq) + '_' + Date.now();
      var timer = setTimeout(function () { cleanup(); reject(new Error('gviz timeout')); }, 12000);
      function cleanup() {
        clearTimeout(timer);
        try { delete global[cbName]; } catch (_) { global[cbName] = undefined; }
        if (s && s.parentNode) s.parentNode.removeChild(s);
      }
      global[cbName] = function (resp) {
        cleanup();
        if (resp && resp.table) resolve(resp.table);
        else reject(new Error('gviz: no table'));
      };
      var url = 'https://docs.google.com/spreadsheets/d/' + encodeURIComponent(CFG.SHEET_ID) +
        '/gviz/tq?tqx=out:json;responseHandler:' + cbName +
        '&sheet=' + encodeURIComponent(tab) + '&headers=1&_=' + Date.now();
      var s = document.createElement('script');
      s.src = url;
      s.onerror = function () { cleanup(); reject(new Error('gviz load error')); };
      document.head.appendChild(s);
    });
  }

  // gviz table → { headers:[...], rows:[[...]] }. Prefers formatted values.
  function tableToGrid(table) {
    var headers = (table.cols || []).map(function (c) { return String((c && c.label) || '').trim(); });
    var hasLabels = headers.some(function (h) { return h; });
    var rows = (table.rows || []).map(function (r) {
      return (r.c || []).map(function (cell) {
        if (!cell) return '';
        return cell.f != null ? cell.f : (cell.v != null ? cell.v : '');
      });
    });
    if (!hasLabels) { headers = (rows.shift() || []).map(String); }
    return { headers: headers, rows: rows };
  }

  function indexOfHeader(headers, name) {
    var target = String(name || '').trim().toLowerCase();
    for (var i = 0; i < headers.length; i++) {
      if (String(headers[i]).trim().toLowerCase() === target) return i;
    }
    return -1;
  }

  // ── AI_Config (standard_field | actual_column) → map ────────
  async function getMapping() {
    var grid = tableToGrid(await gvizTab(CFG.TABS.config));
    var map = {};
    // Locate the two columns even if labelled differently.
    var stdIdx = indexOfHeader(grid.headers, 'standard_field');
    var actIdx = indexOfHeader(grid.headers, 'actual_column');
    if (stdIdx < 0 || actIdx < 0) { stdIdx = 0; actIdx = 1; } // fall back to positional
    grid.rows.forEach(function (r) {
      var std = String(r[stdIdx] || '').trim().toLowerCase().replace(/\s+/g, '_');
      var act = String(r[actIdx] || '').trim();
      if (std && act) map[std] = act;
    });
    return map;
  }

  // Build a client record from a Sheet1 row using the mapping.
  function applyMapping(grid, map) {
    var idx = {};
    CFG.STANDARD_FIELDS.forEach(function (f) {
      var col = map[f];
      var i = col ? indexOfHeader(grid.headers, col) : -1;
      if (i < 0) i = indexOfHeader(grid.headers, f.replace(/_/g, ' ')); // loose fallback
      if (i < 0) i = indexOfHeader(grid.headers, f);
      idx[f] = i;
    });
    return grid.rows
      .map(function (r) {
        var o = { _raw: r };
        CFG.STANDARD_FIELDS.forEach(function (f) {
          o[f] = idx[f] >= 0 ? String(r[idx[f]] == null ? '' : r[idx[f]]).trim() : '';
        });
        return o;
      })
      .filter(function (o) { return o.customer_name || o.phone; });
  }

  // ── High-level reads (with demo fallback) ───────────────────
  var _state = { demo: false, reason: '' };

  async function getClients() {
    try {
      var map = {};
      try { map = await getMapping(); } catch (_) { map = {}; }
      var grid = tableToGrid(await gvizTab(CFG.TABS.clients));
      var clients = applyMapping(grid, map);
      if (!clients.length) throw new Error('no rows');
      _state.demo = false;
      return { clients: clients, mapping: map, headers: grid.headers };
    } catch (e) {
      _state.demo = true; _state.reason = e.message || 'read failed';
      var demo = global.HRSDemo.clients();
      return { clients: demo.clients, mapping: demo.mapping, headers: demo.headers };
    }
  }

  async function getReplies() {
    try {
      var grid = tableToGrid(await gvizTab(CFG.TABS.replies));
      var h = grid.headers;
      var col = {
        ts: pick(h, ['timestamp', 'time', 'date']),
        from: pick(h, ['from', 'phone', 'number']),
        name: pick(h, ['contact name', 'name', 'customer']),
        msg: pick(h, ['message', 'text', 'body']),
        type: pick(h, ['message type', 'type']),
        id: pick(h, ['message id', 'id']),
      };
      var out = grid.rows.map(function (r) {
        return {
          ts: r[col.ts] || '', from: r[col.from] || '', name: r[col.name] || '',
          message: r[col.msg] || '', type: r[col.type] || '', id: r[col.id] || '',
        };
      }).filter(function (x) { return x.message || x.from; });
      if (!out.length) throw new Error('no replies');
      return out;
    } catch (_) {
      return global.HRSDemo.replies();
    }
  }

  async function getEmployees() {
    try {
      var grid = tableToGrid(await gvizTab(CFG.TABS.employees));
      var h = grid.headers;
      var ni = pick(h, ['name', 'employee']), pi = pick(h, ['phone', 'number', 'mobile']), ri = pick(h, ['role', 'designation']);
      var out = grid.rows.map(function (r) {
        return { name: r[ni] || '', phone: r[pi] || '', role: r[ri] || '' };
      }).filter(function (x) { return x.name; });
      if (!out.length) throw new Error('no employees');
      return out;
    } catch (_) {
      return global.HRSDemo.employees();
    }
  }

  function pick(headers, names) {
    for (var i = 0; i < names.length; i++) {
      var idx = indexOfHeader(headers, names[i]);
      if (idx >= 0) return idx;
    }
    return -1;
  }

  // ── Local stats from client rows (mirrors the digest shape) ─
  function computeStats(clients) {
    var today = U.todayKey();
    var s = { totalClients: clients.length, newToday: 0, pendingFollowUps: 0, overdueFollowUps: 0,
      statusCounts: { new: 0, in_progress: 0, completed: 0, cancelled: 0 } };
    clients.forEach(function (c) {
      var st = U.normStatus(c.status);
      if (s.statusCounts[st] == null) s.statusCounts[st] = 0;
      s.statusCounts[st]++;
      if (U.parseDateKey(c.sale_date) === today) s.newToday++;
      var b = U.followUpBucket(c.follow_up_date);
      var open = st !== 'completed' && st !== 'cancelled';
      if (open && (b === 'due_today' || b === 'upcoming' || U.isOverdue(b))) s.pendingFollowUps++;
      if (open && U.isOverdue(b)) s.overdueFollowUps++;
    });
    return s;
  }

  global.HRSApi = {
    triggerWorkflow: triggerWorkflow,
    getClients: getClients,
    getReplies: getReplies,
    getEmployees: getEmployees,
    getMapping: getMapping,
    computeStats: computeStats,
    state: _state,
  };
})(window);
