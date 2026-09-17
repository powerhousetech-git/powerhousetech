/**
 * Harshul Tiles & Fittings — app shell (v4).
 * Gate + hash routing + data loading + shared UI helpers (toast/modal).
 * View renderers live in js/views/*.js and read HRSApp.
 * Loaded last.
 */
(function (global) {
  'use strict';
  var CFG = global.HRS, U = global.HRSUtil, API = global.HRSApi;

  // How often to silently re-pull the sheet (gviz JSONP). Tune here.
  var REFRESH_INTERVAL_MS = 45000;

  var state = {
    clients: [], messages: [], employees: [], grouped: [], mapping: {}, demo: false,
    view: 'home',
    fu: { selectedDate: U.todayKey() },
    msg: { status: 'all', product: 'all' },
    _booted: false,
    _lastUpdated: null,   // Date of the last successful data pull.
    _pendingRender: false, // A refresh landed while the UI was busy; re-render when free.
  };

  var _refreshTimer = null;
  var _refreshing = false;

  function $(s, r) { return (r || document).querySelector(s); }
  function main() { return $('#main-content'); }

  // ── Toast ───────────────────────────────────────────────────
  function toast(msg, kind) {
    var t = $('#toast');
    t.textContent = msg; t.className = 'toast show ' + (kind || '');
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.className = 'toast'; }, 3800);
  }

  // ── Modal ───────────────────────────────────────────────────
  function modalRoot() { return $('#modal-root'); }
  function closeModal() {
    modalRoot().innerHTML = ''; modalRoot().classList.remove('open');
    // A background refresh may have arrived while the modal was open; apply it now.
    flushPendingRender();
  }
  function openModal(html) {
    modalRoot().innerHTML = '<div class="modal-backdrop" data-close><div class="modal" role="dialog">' + html + '</div></div>';
    modalRoot().classList.add('open');
    modalRoot().querySelectorAll('[data-close]').forEach(function (el) {
      el.addEventListener('click', function (e) { if (e.target === el) closeModal(); });
    });
    var x = modalRoot().querySelector('[data-x]'); if (x) x.addEventListener('click', closeModal);
  }
  function setBusy(btn, busy, label) {
    if (!btn) return;
    if (busy) { btn._t = btn.textContent; btn.disabled = true; btn.textContent = label || 'Working…'; }
    else { btn.disabled = false; if (btn._t) btn.textContent = btn._t; }
  }
  function webhookMiss(res, label) {
    if (res.ackOnly) toast(label + ': workflow not listening — activate it in n8n (or click “Execute workflow”).', 'err');
    else if (res.status === 0) toast(label + ' failed: network error (workflow may be inactive).', 'err');
    else toast(label + ' failed (' + res.status + ').', 'err');
  }

  // ── Gate ────────────────────────────────────────────────────
  function gateOk() { try { return sessionStorage.getItem(CFG.GATE_KEY) === '1'; } catch (_) { return false; } }
  function openApp() {
    $('#gate-view').classList.add('hidden');
    $('#app-shell').classList.remove('hidden');
    if (!state._booted) { state._booted = true; boot(); }
  }
  function initGate() {
    if (gateOk()) return openApp();
    $('#gate-view').classList.remove('hidden');
    $('#app-shell').classList.add('hidden');
    $('#login-form').addEventListener('submit', function (e) {
      e.preventDefault();
      if ($('#login-passcode').value.trim() === CFG.GATE_PASSCODE) {
        try { sessionStorage.setItem(CFG.GATE_KEY, '1'); } catch (_) {}
        $('#login-error').style.display = 'none'; openApp();
      } else { var el = $('#login-error'); el.textContent = 'Incorrect passcode.'; el.style.display = 'block'; }
    });
  }
  function signOut() { try { sessionStorage.removeItem(CFG.GATE_KEY); } catch (_) {} location.reload(); }

  // ── Boot / data ─────────────────────────────────────────────
  async function boot() {
    wireNav();
    var h = location.hash.replace('#', ''); if (h) state.view = normView(h);
    main().innerHTML = '<div class="loading"><span class="spinner"></span>Loading dashboard…</div>';
    await reload();
    startAutoRefresh();
  }
  async function reload() {
    var data = await API.loadAll();
    applyData(data);
    render();
  }

  // Shared state mutation for both the initial reload and background refreshes.
  function applyData(data) {
    state.clients = data.clients; state.messages = data.messages; state.employees = data.employees;
    state.mapping = data.mapping; state.demo = data.demo;
    state.grouped = API.groupMessages(state.clients, state.messages);
    var b = $('#demo-banner'); if (b) b.style.display = state.demo ? 'block' : 'none';
    state._lastUpdated = new Date();
    updateStamp();
  }

  // ── Auto-refresh (polling + visibility) ─────────────────────
  function updateStamp() {
    var el = $('#updated-label');
    if (el) el.textContent = state._lastUpdated ? 'Updated ' + U.fmtTimeShort(state._lastUpdated) : 'Updated —';
  }
  // True when a re-render would clobber what the user is doing.
  function uiBusy() {
    if (modalRoot().classList.contains('open')) return true;
    var ae = document.activeElement;
    if (ae && main() && main().contains(ae)) {
      var tag = ae.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    }
    return false;
  }
  function flushPendingRender() {
    if (state._pendingRender && !uiBusy()) { state._pendingRender = false; render(); }
  }
  // Silent background pull: refresh state, re-render the CURRENT view unless busy.
  async function refreshData(manual) {
    if (_refreshing) return;
    _refreshing = true;
    var btn = $('#btn-refresh');
    if (manual && btn) btn.classList.add('is-busy');
    try {
      var data = await API.loadAll();
      applyData(data);
      if (manual || !uiBusy()) { state._pendingRender = false; render(); }
      else { state._pendingRender = true; }
    } catch (_) {
      // loadAll already falls back to demo data; ignore transient errors.
    } finally {
      _refreshing = false;
      if (manual && btn) btn.classList.remove('is-busy');
    }
  }
  function startAutoRefresh() {
    if (_refreshTimer) clearInterval(_refreshTimer);
    _refreshTimer = setInterval(function () {
      if (!document.hidden) refreshData(false); // pause polling while tab is hidden
    }, REFRESH_INTERVAL_MS);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) refreshData(false); // near-instant catch-up on return
    });
    window.addEventListener('focus', function () { refreshData(false); });
    var btn = $('#btn-refresh');
    if (btn) btn.addEventListener('click', function () { refreshData(true); });
  }

  function normView(v) {
    if (v === 'dashboard') return 'home';
    if (v === 'messages' || v === 'follow-ups' || v === 'home') return v;
    return 'home';
  }
  function wireNav() {
    document.querySelectorAll('.nav-link').forEach(function (a) {
      a.addEventListener('click', function (e) { e.preventDefault(); go(a.getAttribute('data-view')); $('#app-shell').classList.remove('nav-open'); });
    });
    var so = $('#btn-signout'); if (so) so.addEventListener('click', signOut);
    var mb = $('#btn-menu'); if (mb) mb.addEventListener('click', function () { $('#app-shell').classList.toggle('nav-open'); });
    window.addEventListener('hashchange', function () { var v = normView(location.hash.replace('#', '')); if (v !== state.view) { state.view = v; render(); highlight(); } });
  }
  function go(view) { state.view = normView(view); location.hash = state.view; highlight(); render(); }
  function highlight() {
    document.querySelectorAll('.nav-link').forEach(function (a) { a.classList.toggle('active', a.getAttribute('data-view') === state.view); });
  }
  function render() {
    highlight();
    var V = global.HRSViews || {};
    if (state.view === 'messages' && V.messages) return V.messages(HRSApp);
    if (state.view === 'follow-ups' && V.followups) return V.followups(HRSApp);
    if (V.home) return V.home(HRSApp);
    main().innerHTML = '<p class="muted center">View not available.</p>';
  }

  // Shared render helpers used by views.
  function pageHead(title, sub, actions) {
    return '<div class="page-head"><div><h1>' + U.esc(title) + '</h1>' +
      (sub ? '<p class="page-sub">' + U.esc(sub) + '</p>' : '') + '</div>' +
      '<div class="page-actions">' + (actions || '') + '</div></div>';
  }

  var HRSApp = {
    state: state, main: main, esc: U.esc,
    toast: toast, openModal: openModal, closeModal: closeModal, setBusy: setBusy, webhookMiss: webhookMiss,
    render: render, reload: reload, refreshData: refreshData, go: go, signOut: signOut, pageHead: pageHead,
  };
  global.HRSApp = HRSApp;
  document.addEventListener('DOMContentLoaded', initGate);
})(window);
