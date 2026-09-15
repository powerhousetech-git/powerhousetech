/**
 * Harshul Tiles & Fittings — dashboard app.
 * Vanilla JS SPA. Loaded last (after config, util, demo, api).
 */
(function (global) {
  'use strict';

  var CFG = global.HRS, U = global.HRSUtil, API = global.HRSApi;
  var esc = U.esc;

  var state = {
    clients: [], employees: [], replies: [], mapping: {}, headers: [],
    demo: false, view: 'dashboard', digest: null,
    filters: { status: '', employee: '', q: '' },
  };

  // ── DOM helpers ─────────────────────────────────────────────
  function $(sel, root) { return (root || document).querySelector(sel); }
  function main() { return $('#main-content'); }

  function toast(msg, kind) {
    var t = $('#toast');
    t.textContent = msg;
    t.className = 'toast show ' + (kind || '');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.className = 'toast'; }, 3600);
  }

  // ── Gate ────────────────────────────────────────────────────
  function gateOk() {
    try { return sessionStorage.getItem(CFG.GATE_KEY) === '1'; } catch (_) { return false; }
  }
  function openApp() {
    $('#gate-view').classList.add('hidden');
    $('#app-shell').classList.remove('hidden');
    if (!state._booted) { state._booted = true; boot(); }
  }
  function initGate() {
    if (gateOk()) { openApp(); return; }
    $('#gate-view').classList.remove('hidden');
    $('#app-shell').classList.add('hidden');
    $('#login-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var val = $('#login-passcode').value.trim();
      if (val === CFG.GATE_PASSCODE) {
        try { sessionStorage.setItem(CFG.GATE_KEY, '1'); } catch (_) {}
        $('#login-error').style.display = 'none';
        openApp();
      } else {
        var err = $('#login-error');
        err.textContent = 'Incorrect passcode.';
        err.style.display = 'block';
      }
    });
  }
  function signOut() {
    try { sessionStorage.removeItem(CFG.GATE_KEY); } catch (_) {}
    location.reload();
  }

  // ── Boot / data load ────────────────────────────────────────
  async function boot() {
    wireNav();
    render(); // initial (loading)
    await reload();
    render();
  }
  async function reload() {
    main().innerHTML = loadingBlock('Loading dashboard…');
    var res = await API.getClients();
    state.clients = res.clients; state.mapping = res.mapping; state.headers = res.headers;
    state.demo = API.state.demo;
    state.employees = await API.getEmployees();
    state.replies = await API.getReplies();
    demoBanner();
  }
  function demoBanner() {
    var b = $('#demo-banner');
    if (!b) return;
    b.style.display = state.demo ? 'block' : 'none';
  }

  // ── Navigation ──────────────────────────────────────────────
  function wireNav() {
    document.querySelectorAll('.nav-link').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        go(a.getAttribute('data-view'));
        var sb = $('#app-shell'); if (sb) sb.classList.remove('nav-open');
      });
    });
    var sob = $('#btn-signout'); if (sob) sob.addEventListener('click', signOut);
    var mob = $('#btn-menu'); if (mob) mob.addEventListener('click', function () {
      $('#app-shell').classList.toggle('nav-open');
    });
    window.addEventListener('hashchange', function () {
      var v = location.hash.replace('#', ''); if (v) go(v);
    });
    var h = location.hash.replace('#', ''); if (h) state.view = h;
  }
  function go(view) {
    state.view = view || 'dashboard';
    location.hash = state.view;
    document.querySelectorAll('.nav-link').forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('data-view') === state.view);
    });
    render();
  }

  function render() {
    document.querySelectorAll('.nav-link').forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('data-view') === state.view);
    });
    var v = state.view;
    if (v === 'clients') return renderClients();
    if (v === 'follow-ups') return renderFollowUps();
    if (v === 'replies') return renderReplies();
    if (v === 'settings') return renderSettings();
    return renderDashboard();
  }

  function loadingBlock(msg) {
    return '<div class="loading"><span class="spinner"></span>' + esc(msg || 'Loading…') + '</div>';
  }
  function pageHead(title, sub, actions) {
    return '<div class="page-head"><div><h1>' + esc(title) + '</h1>' +
      (sub ? '<p class="page-sub">' + esc(sub) + '</p>' : '') + '</div>' +
      '<div class="page-actions">' + (actions || '') + '</div></div>';
  }

  // ── View: Dashboard ─────────────────────────────────────────
  function renderDashboard() {
    var s = state.digest && state.digest.stats ? state.digest.stats : API.computeStats(state.clients);
    var cards = [
      ['Total Clients', s.totalClients, 'brand'],
      ['New Today', s.newToday, 'teal'],
      ['Pending Follow-Ups', s.pendingFollowUps, 'amber'],
      ['Overdue Follow-Ups', s.overdueFollowUps, 'red'],
    ].map(function (c) {
      return '<div class="kpi kpi-' + c[2] + '"><div class="kpi-label">' + esc(c[0]) +
        '</div><div class="kpi-value">' + esc(String(c[1])) + '</div></div>';
    }).join('');

    var quick =
      '<div class="quick-actions">' +
      '<button class="btn btn-primary" data-act="send">✉️ Send Message</button>' +
      '<button class="btn btn-teal" data-act="digest">📊 Run Digest</button>' +
      '<button class="btn btn-amber" data-act="followup">🔔 Check Follow-Ups</button>' +
      '</div>';

    var digestPanel = '';
    if (state.digest) {
      var st = state.digest.stats || {};
      var sc = st.statusCounts || {};
      digestPanel = '<div class="card"><h3>Latest Digest</h3><div class="digest-grid">' +
        digestStat('Total', st.totalClients) + digestStat('New today', st.newToday) +
        digestStat('Pending', st.pendingFollowUps) + digestStat('Overdue', st.overdueFollowUps) +
        digestStat('New', sc.new) + digestStat('In progress', sc.in_progress) +
        digestStat('Completed', sc.completed) + digestStat('Cancelled', sc.cancelled) +
        '</div></div>';
    }

    var acts = U.getActivity();
    var feed = acts.length ? acts.map(function (a) {
      return '<li><span class="act-dot ' + esc(a.tone || '') + '"></span>' +
        '<span class="act-text">' + esc(a.text) + '</span>' +
        '<span class="act-time">' + esc(U.fmtDateTime(a.ts)) + '</span></li>';
    }).join('') : '<li class="muted">No recent actions yet.</li>';

    main().innerHTML =
      pageHead('Dashboard', 'Post-sale automation & follow-up overview') +
      '<div class="kpi-row">' + cards + '</div>' +
      '<div class="card"><h3>Quick Actions</h3>' + quick +
      '<p class="hint">Actions run the matching n8n workflow (' +
      (CFG.USE_TEST ? 'test' : 'production') + ' webhooks).</p></div>' +
      digestPanel +
      '<div class="card"><h3>Recent Activity</h3><ul class="activity">' + feed + '</ul></div>';

    main().querySelectorAll('[data-act]').forEach(function (b) {
      b.addEventListener('click', function () {
        var a = b.getAttribute('data-act');
        if (a === 'send') openSendModal();
        else if (a === 'digest') runDigest(b);
        else if (a === 'followup') runFollowup(b);
      });
    });
  }
  function digestStat(label, v) {
    return '<div class="dg"><div class="dg-v">' + esc(String(v == null ? '—' : v)) +
      '</div><div class="dg-l">' + esc(label) + '</div></div>';
  }

  // ── View: Clients ───────────────────────────────────────────
  function renderClients() {
    var emps = uniqueEmployees();
    var statusOpts = ['', 'new', 'in_progress', 'completed', 'cancelled'].map(function (v) {
      return '<option value="' + v + '"' + (state.filters.status === v ? ' selected' : '') + '>' +
        (v ? esc(U.statusLabel(v)) : 'All statuses') + '</option>';
    }).join('');
    var empOpts = ['<option value="">All employees</option>'].concat(emps.map(function (e) {
      return '<option value="' + esc(e) + '"' + (state.filters.employee === e ? ' selected' : '') + '>' + esc(e) + '</option>';
    })).join('');

    var toolbar =
      '<div class="toolbar">' +
      '<input id="cl-search" class="input" placeholder="Search name or phone…" value="' + esc(state.filters.q) + '">' +
      '<select id="cl-status" class="input">' + statusOpts + '</select>' +
      '<select id="cl-emp" class="input">' + empOpts + '</select>' +
      '</div>';

    var rows = filteredClients();
    var body = rows.length ? rows.map(clientRow).join('') :
      '<tr><td colspan="7" class="muted center">No clients match.</td></tr>';

    main().innerHTML =
      pageHead('Clients', state.clients.length + ' records · mapped from AI_Config',
        '<button class="btn btn-primary btn-sm" data-act="send">✉️ Send Message</button>') +
      '<div class="card">' + toolbar +
      '<div class="table-wrap"><table class="tbl"><thead><tr>' +
      '<th>Customer</th><th>Phone</th><th>Status</th><th>Follow-Up</th><th>Assigned</th><th>Product</th><th></th>' +
      '</tr></thead><tbody>' + body + '</tbody></table></div></div>';

    var sd = $('#cl-search'); if (sd) sd.addEventListener('input', function () { state.filters.q = this.value; refreshClientBody(); });
    $('#cl-status').addEventListener('change', function () { state.filters.status = this.value; refreshClientBody(); });
    $('#cl-emp').addEventListener('change', function () { state.filters.employee = this.value; refreshClientBody(); });
    bindRowActions(main());
    main().querySelector('[data-act="send"]').addEventListener('click', function () { openSendModal(); });
  }
  function refreshClientBody() {
    var tb = main().querySelector('tbody'); if (!tb) return;
    var rows = filteredClients();
    tb.innerHTML = rows.length ? rows.map(clientRow).join('') :
      '<tr><td colspan="7" class="muted center">No clients match.</td></tr>';
    bindRowActions(main());
  }
  function clientRow(c, i) {
    var b = U.followUpBucket(c.follow_up_date);
    return '<tr>' +
      '<td><div class="cell-strong">' + esc(c.customer_name || '—') + '</div>' +
      (c.notes ? '<div class="cell-sub">' + esc(c.notes) + '</div>' : '') + '</td>' +
      '<td>' + esc(U.fmtPhone(c.phone)) + '</td>' +
      '<td>' + U.statusBadge(c.status) + '</td>' +
      '<td>' + esc(U.fmtDate(c.follow_up_date)) +
      (U.isOverdue(b) ? ' <span class="pill pill-red">' + esc(U.BUCKET_LABELS[b]) + '</span>' :
        (b === 'due_today' ? ' <span class="pill pill-amber">Today</span>' : '')) + '</td>' +
      '<td>' + esc(c.assigned_to || '—') + '</td>' +
      '<td>' + esc(c.product || '—') + '</td>' +
      '<td class="row-actions">' +
      '<button class="icon-btn" title="Send message" data-send="' + esc(c.phone) + '">✉️</button>' +
      '<button class="icon-btn" title="Mark done" data-done="' + esc(c.phone) + '" data-name="' + esc(c.customer_name) + '">✓</button>' +
      '</td></tr>';
  }
  function bindRowActions(root) {
    root.querySelectorAll('[data-send]').forEach(function (b) {
      b.addEventListener('click', function () { openSendModal(b.getAttribute('data-send')); });
    });
    root.querySelectorAll('[data-done]').forEach(function (b) {
      b.addEventListener('click', function () { openMarkDoneModal(b.getAttribute('data-done'), b.getAttribute('data-name')); });
    });
  }
  function filteredClients() {
    var f = state.filters, q = f.q.trim().toLowerCase();
    return state.clients.filter(function (c) {
      if (f.status && U.normStatus(c.status) !== f.status) return false;
      if (f.employee && c.assigned_to !== f.employee) return false;
      if (q) {
        var hay = (c.customer_name + ' ' + c.phone).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
  }
  function uniqueEmployees() {
    var set = {};
    state.clients.forEach(function (c) { if (c.assigned_to) set[c.assigned_to] = 1; });
    state.employees.forEach(function (e) { if (e.name) set[e.name] = 1; });
    return Object.keys(set).sort();
  }

  // ── View: Follow-Ups ────────────────────────────────────────
  function renderFollowUps() {
    var open = state.clients.filter(function (c) {
      var st = U.normStatus(c.status); return st !== 'completed' && st !== 'cancelled';
    });
    var groups = { due_today: [], overdue_1_3: [], overdue_3_7: [], overdue_7_plus: [], upcoming: [] };
    open.forEach(function (c) {
      var b = U.followUpBucket(c.follow_up_date);
      if (groups[b]) groups[b].push(c);
    });
    var order = [
      ['overdue_7_plus', 'crit'], ['overdue_3_7', 'red'], ['overdue_1_3', 'amber'],
      ['due_today', 'today'], ['upcoming', 'green'],
    ];
    var sections = order.map(function (o) {
      var key = o[0], list = groups[key];
      if (!list.length) return '';
      var items = list.map(function (c) {
        return '<div class="fu-row fu-' + o[1] + '">' +
          '<div class="fu-main"><div class="cell-strong">' + esc(c.customer_name || '—') + '</div>' +
          '<div class="cell-sub">' + esc(U.fmtPhone(c.phone)) + ' · ' + esc(c.product || '—') +
          (c.assigned_to ? ' · ' + esc(c.assigned_to) : '') + '</div>' +
          (c.notes ? '<div class="cell-sub">' + esc(c.notes) + '</div>' : '') + '</div>' +
          '<div class="fu-side"><div class="fu-date">' + esc(U.fmtDate(c.follow_up_date)) + '</div>' +
          '<div class="row-actions">' +
          '<button class="icon-btn" title="Send message" data-send="' + esc(c.phone) + '">✉️</button>' +
          '<button class="btn btn-sm btn-ghost" data-done="' + esc(c.phone) + '" data-name="' + esc(c.customer_name) + '">Mark Done</button>' +
          '</div></div></div>';
      }).join('');
      return '<div class="card fu-section"><div class="fu-head"><h3>' + esc(U.BUCKET_LABELS[key]) +
        '</h3><span class="count-pill count-' + o[1] + '">' + list.length + '</span></div>' + items + '</div>';
    }).join('');

    if (!sections) sections = '<div class="card"><p class="muted center">No open follow-ups. 🎉</p></div>';

    main().innerHTML =
      pageHead('Follow-Up Tracker', 'Due & overdue follow-ups (IST)',
        '<button class="btn btn-amber" data-act="followup">🔔 Send All Reminders</button>') +
      sections;

    main().querySelector('[data-act="followup"]').addEventListener('click', function (e) { runFollowup(e.currentTarget); });
    bindRowActions(main());
  }

  // ── View: Replies ───────────────────────────────────────────
  function renderReplies() {
    var list = state.replies.slice().sort(function (a, b) {
      return new Date(b.ts) - new Date(a.ts);
    });
    var items = list.length ? list.map(function (r) {
      return '<div class="reply">' +
        '<div class="reply-head"><span class="reply-name">' + esc(r.name || U.fmtPhone(r.from)) + '</span>' +
        '<span class="reply-time">' + esc(U.fmtDateTime(r.ts)) + '</span></div>' +
        '<div class="reply-msg">' + esc(r.message) + '</div>' +
        '<div class="reply-foot"><span class="muted">' + esc(U.fmtPhone(r.from)) + '</span>' +
        '<button class="btn btn-sm btn-ghost" data-send="' + esc(r.from) + '">Reply</button></div>' +
        '</div>';
    }).join('') : '<p class="muted center">No replies yet.</p>';

    main().innerHTML =
      pageHead('Reply History', 'Incoming WhatsApp messages (Replies tab)') +
      '<div class="card reply-list">' + items + '</div>';
    bindRowActions(main());
  }

  // ── View: Settings ──────────────────────────────────────────
  function renderSettings() {
    var mapRows = CFG.STANDARD_FIELDS.map(function (f) {
      var actual = state.mapping[f];
      return '<tr><td><code>' + esc(f) + '</code></td><td>' +
        (actual ? esc(actual) : '<span class="muted">— not mapped —</span>') + '</td></tr>';
    }).join('');

    var wfRows = CFG.N8N_WORKFLOWS.map(function (w) {
      return '<tr><td>' + esc(w.name) + '</td><td><span class="pill">' + esc(w.kind) + '</span></td>' +
        '<td>' + (w.webhook ? '<code>/' + esc(w.webhook) + '</code>' : '<span class="muted">—</span>') + '</td>' +
        '<td><a class="link" href="' + esc(CFG.workflowUrl(w.id)) + '" target="_blank" rel="noopener">open ↗</a></td></tr>';
    }).join('');

    main().innerHTML =
      pageHead('Settings', 'Connections, AI mapping & workflow registry') +
      '<div class="card"><h3>Backend</h3>' +
      '<div class="kv"><span>Webhook mode</span><span>' +
      '<label class="switch"><input type="checkbox" id="tgl-test"' + (CFG.USE_TEST ? ' checked' : '') + '>' +
      '<span class="slider"></span></label> ' +
      '<b>' + (CFG.USE_TEST ? 'Test (/webhook-test)' : 'Production (/webhook)') + '</b></span></div>' +
      '<div class="kv"><span>Webhook base</span><code>' + esc(CFG.N8N_BASE) + '</code></div>' +
      '<div class="kv"><span>Google Sheet</span><a class="link" href="' + esc(CFG.SHEET_URL) + '" target="_blank" rel="noopener">' + esc(CFG.SHEET_ID) + ' ↗</a></div>' +
      '<div class="kv"><span>Data source</span><span>' + (state.demo ? '<span class="pill pill-amber">Demo fallback</span>' : '<span class="pill pill-green">Live sheet (gviz)</span>') + '</span></div>' +
      '</div>' +
      '<div class="card"><h3>AI Column Mapping <span class="muted">(AI_Config)</span></h3>' +
      '<div class="table-wrap"><table class="tbl"><thead><tr><th>Standard field</th><th>Actual column</th></tr></thead><tbody>' +
      mapRows + '</tbody></table></div></div>' +
      '<div class="card"><h3>n8n Workflows</h3>' +
      '<div class="table-wrap"><table class="tbl"><thead><tr><th>Workflow</th><th>Type</th><th>Webhook</th><th></th></tr></thead><tbody>' +
      wfRows + '</tbody></table></div></div>';

    $('#tgl-test').addEventListener('change', function () {
      CFG.USE_TEST = this.checked;
      toast('Switched to ' + (CFG.USE_TEST ? 'test' : 'production') + ' webhooks', 'ok');
      renderSettings();
    });
  }

  // ── Actions ─────────────────────────────────────────────────
  async function runDigest(btn) {
    setBusy(btn, true, 'Running…');
    var res = await API.triggerWorkflow('trigger_digest', {});
    setBusy(btn, false);
    if (res.ok && res.data && res.data.stats) {
      state.digest = res.data;
      U.logActivity({ text: 'Ran daily digest', tone: 'teal' });
      toast('Digest complete', 'ok');
      if (state.view === 'dashboard') renderDashboard();
    } else {
      handleWebhookMiss(res, 'Digest');
    }
  }
  async function runFollowup(btn) {
    setBusy(btn, true, 'Sending…');
    var res = await API.triggerWorkflow('trigger_followup', {});
    setBusy(btn, false);
    if (res.ok) {
      var n = res.data && (res.data.remindersSent != null ? res.data.remindersSent : res.data.reminders);
      U.logActivity({ text: 'Sent follow-up reminders' + (n != null ? ' (' + n + ')' : ''), tone: 'amber' });
      toast('Reminders sent' + (n != null ? ': ' + n : ''), 'ok');
    } else {
      handleWebhookMiss(res, 'Follow-up check');
    }
  }

  // ── Modals ──────────────────────────────────────────────────
  function modalRoot() { return $('#modal-root'); }
  function closeModal() { modalRoot().innerHTML = ''; modalRoot().classList.remove('open'); }
  function openModal(html) {
    modalRoot().innerHTML =
      '<div class="modal-backdrop" data-close="1"><div class="modal" role="dialog">' + html + '</div></div>';
    modalRoot().classList.add('open');
    modalRoot().querySelectorAll('[data-close]').forEach(function (el) {
      el.addEventListener('click', function (e) { if (e.target === el) closeModal(); });
    });
    var x = modalRoot().querySelector('[data-x]'); if (x) x.addEventListener('click', closeModal);
  }

  function clientByPhone(phone) {
    var n = U.normPhone(phone);
    return state.clients.find(function (c) { return U.normPhone(c.phone) === n; });
  }

  function openSendModal(phone) {
    var c = phone ? clientByPhone(phone) : null;
    openModal(
      '<div class="modal-head"><h3>Send WhatsApp Message</h3><button class="icon-btn" data-x>✕</button></div>' +
      '<div class="modal-body">' +
      '<label class="fld">Phone number<input id="sm-phone" class="input" value="' + esc(U.normPhone(phone) || CFG.TEST_PHONE) + '"></label>' +
      (c ? '<p class="hint">To: <b>' + esc(c.customer_name) + '</b></p>' : '') +
      '<label class="fld">Message<textarea id="sm-msg" class="input" rows="4" placeholder="Type your message…">' +
      (c ? 'नमस्ते ' + esc(c.customer_name) + ', Harshul Tiles & Fittings की ओर से धन्यवाद!' : '') + '</textarea></label>' +
      '</div>' +
      '<div class="modal-foot"><button class="btn btn-ghost" data-x>Cancel</button>' +
      '<button class="btn btn-primary" id="sm-send">Send</button></div>'
    );
    $('#sm-send').addEventListener('click', async function () {
      var phoneVal = U.normPhone($('#sm-phone').value);
      var msg = $('#sm-msg').value.trim();
      if (!phoneVal || !msg) { toast('Phone and message are required', 'err'); return; }
      setBusy(this, true, 'Sending…');
      var res = await API.triggerWorkflow('send_message', { phone: phoneVal, message: msg });
      setBusy(this, false);
      if (res.ok) {
        U.logActivity({ text: 'Sent message to ' + U.fmtPhone(phoneVal), tone: 'teal' });
        toast('Message sent', 'ok'); closeModal();
      } else { handleWebhookMiss(res, 'Send message'); }
    });
  }

  function openMarkDoneModal(phone, name) {
    openModal(
      '<div class="modal-head"><h3>Mark Follow-Up Done</h3><button class="icon-btn" data-x>✕</button></div>' +
      '<div class="modal-body">' +
      (name ? '<p class="hint">Customer: <b>' + esc(name) + '</b> · ' + esc(U.fmtPhone(phone)) + '</p>' : '') +
      '<label class="fld">Status<select id="md-status" class="input">' +
      '<option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label>' +
      '<label class="fld">Notes (optional)<textarea id="md-notes" class="input" rows="3" placeholder="e.g. Customer confirmed delivery"></textarea></label>' +
      '</div>' +
      '<div class="modal-foot"><button class="btn btn-ghost" data-x>Cancel</button>' +
      '<button class="btn btn-primary" id="md-save">Update</button></div>'
    );
    $('#md-save').addEventListener('click', async function () {
      var status = $('#md-status').value;
      var notes = $('#md-notes').value.trim();
      setBusy(this, true, 'Updating…');
      var res = await API.triggerWorkflow('mark_done', { phone: U.normPhone(phone), status: status, notes: notes });
      setBusy(this, false);
      if (res.ok) {
        // Optimistic local update.
        var c = clientByPhone(phone); if (c) c.status = status;
        U.logActivity({ text: 'Marked ' + (name || U.fmtPhone(phone)) + ' as ' + status, tone: status === 'completed' ? 'green' : 'red' });
        toast('Follow-up updated', 'ok'); closeModal(); render();
      } else { handleWebhookMiss(res, 'Mark done'); }
    });
  }

  // ── Shared ──────────────────────────────────────────────────
  function setBusy(btn, busy, label) {
    if (!btn) return;
    if (busy) { btn._t = btn.textContent; btn.disabled = true; btn.textContent = label || 'Working…'; }
    else { btn.disabled = false; if (btn._t) btn.textContent = btn._t; }
  }
  function handleWebhookMiss(res, label) {
    if (res.ackOnly) {
      toast(label + ': workflow not listening. In n8n, open the workflow and click “Execute workflow”, or activate it.', 'err');
    } else if (res.status === 0) {
      toast(label + ' failed: network error (workflow may be inactive).', 'err');
    } else {
      toast(label + ' failed (' + res.status + ').', 'err');
    }
  }

  // ── Init ────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', initGate);

  global.HRSApp = { go: go, reload: reload, signOut: signOut };
})(window);
