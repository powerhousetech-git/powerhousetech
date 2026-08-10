(function () {
  'use strict';

  var SUPABASE_URL = 'https://msratyvmnuvozuthgkmi.supabase.co';
  var API = SUPABASE_URL + '/functions/v1/invoice-radar-proxy';
  var state = { snapshot: null, view: 'overview', loading: false, user: null };

  var VIEWS = {
    overview: ['Dashboard', 'Everything owed to you and by you, in one place.'],
    receivables: ['Receivables', 'Invoices your customers still owe you.'],
    approvals: ['Approvals', 'Verify reminders before they reach your customers.'],
    reminders: ['Follow-ups', 'Reminder sequences — auto for gentle, approval for firm.'],
    payables: ['Payables', 'Bills you need to pay, captured automatically.'],
    capture: ['Capture', 'Turn any invoice into clean data.'],
    activity: ['Activity / Sheet', 'Audit trail from your Master Sheet Log tab.'],
    integrations: ['Integrations', 'How invoices come in and reminders go out.']
  };

  var SRC_LABEL = { photo: 'Photo', email: 'Gmail', manual: 'Manual', zoho: 'Zoho' };

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fmt(n) {
    return '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
  }
  function dstr(s) {
    if (!s) return '—';
    var d = new Date(s);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  function toast(msg, isError) {
    var el = $('ir-toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle('is-error', !!isError);
    el.classList.add('is-show');
    window.setTimeout(function () { el.classList.remove('is-show'); }, 3200);
  }

  async function getAuthHeaders() {
    var user = window.phFirebaseAuth && window.phFirebaseAuth.auth && window.phFirebaseAuth.auth.currentUser;
    if (!user) return null;
    var token = await user.getIdToken();
    return { Authorization: 'Bearer ' + token };
  }

  async function apiGet(path) {
    var headers = await getAuthHeaders();
    if (!headers) return { status: 401 };
    return fetch(API + (path || ''), { headers: headers });
  }

  async function apiPost(body) {
    var headers = await getAuthHeaders();
    if (!headers) return { status: 401 };
    return fetch(API, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
      body: JSON.stringify(body)
    });
  }

  function showGate(kind, message) {
    $('ir-app-shell').classList.add('ir-hidden');
    $('ir-gate').classList.remove('ir-hidden');
    $('ir-gate-title').textContent = kind === 'signin' ? 'Sign in to Invoice Radar' : 'Invoice Radar not enabled';
    $('ir-gate-msg').textContent = message || (
      kind === 'signin'
        ? 'Use your Google account to open your receivables dashboard.'
        : 'This service is not on your account yet. Talk to PowerhouseTech to get Invoice Radar watching your invoices.'
    );
    $('ir-gate-signin').classList.toggle('ir-hidden', kind !== 'signin');
    $('ir-gate-upsell').classList.toggle('ir-hidden', kind !== 'upsell');
  }

  function showApp() {
    $('ir-gate').classList.add('ir-hidden');
    $('ir-app-shell').classList.remove('ir-hidden');
  }

  async function loadSnapshot() {
    state.loading = true;
    $('ir-loading').classList.remove('ir-hidden');
    var res = await apiGet('?op=snapshot');
    state.loading = false;
    $('ir-loading').classList.add('ir-hidden');

    if (res.status === 401) {
      showGate('signin');
      return false;
    }
    if (res.status === 403) {
      var body = await res.json().catch(function () { return {}; });
      showGate('upsell', body.message);
      return false;
    }
    if (!res.ok) {
      toast('Could not load dashboard data.', true);
      return false;
    }

    state.snapshot = await res.json();
    showApp();
    renderAll();
    return true;
  }

  async function runAction(action, payload, optimistic) {
    if (optimistic) renderAll();
    var res = await apiPost(Object.assign({ action: action }, payload || {}));
    if (!res.ok) {
      var err = await res.json().catch(function () { return {}; });
      toast(err.message || 'Action failed.', true);
      await loadSnapshot();
      return;
    }
    toast('Saved.');
    await loadSnapshot();
  }

  function pillHtml(pill, label) {
    var cls = 'ir-pill--pending';
    if (pill === 'r1_sent') cls = 'ir-pill--r1';
    else if (pill === 'approval') cls = 'ir-pill--approval';
    else if (pill === 'paid') cls = 'ir-pill--paid';
    else if (pill === 'review') cls = 'ir-pill--review';
    return '<span class="ir-pill ' + cls + '">' + esc(label || pill) + '</span>';
  }

  function renderBadges() {
    var s = state.snapshot;
    if (!s || !s.kpis) return;
    var appr = $('nav-appr');
    var rev = $('nav-rev');
    if (appr) {
      appr.textContent = s.kpis.approvalCount || 0;
      appr.style.display = s.kpis.approvalCount ? 'inline-block' : 'none';
    }
    if (rev) {
      rev.textContent = s.kpis.reviewCount || 0;
      rev.style.display = s.kpis.reviewCount ? 'inline-block' : 'none';
    }
  }

  function renderKPIs() {
    var s = state.snapshot;
    if (!s) return;
    var k = s.kpis || {};
    var html = function (l, v, f, c) {
      return '<div class="ir-kpi"><div class="label">' + esc(l) + '</div><div class="val">' + esc(v) +
        '</div>' + (f ? '<div class="foot ' + (c || '') + '">' + esc(f) + '</div>' : '') + '</div>';
    };
    $('kpi-overview').innerHTML =
      html('Outstanding', fmt(k.outstanding), (k.overdueCount || 0) + ' invoices overdue', 'warn') +
      html('Overdue', fmt(k.overdue), (k.approvalCount || 0) + ' awaiting approval', 'warn') +
      html('Payable', fmt(k.payable), (k.openInvoices || 0) + ' open receivables', '');
    $('kpi-ar').innerHTML =
      html('Total outstanding', fmt(k.outstanding)) +
      html('Overdue', fmt(k.overdue), (k.overdueCount || 0) + ' invoices', 'warn') +
      html('Open invoices', String(k.openInvoices || 0));
    $('kpi-ap').innerHTML =
      html('Total payable', fmt(k.payable)) +
      html('Bills tracked', String((s.payables || []).length));
  }

  function renderBanner() {
    var n = (state.snapshot && state.snapshot.kpis && state.snapshot.kpis.approvalCount) || 0;
    var el = $('appr-banner');
    if (!el) return;
    el.innerHTML = n ? (
      '<div class="ir-banner" role="button" tabindex="0" data-go="approvals">' +
      '<div class="b-ic">!</div><div><div class="ir-appr-top"><span class="who">' + n +
      ' reminder' + (n > 1 ? 's' : '') + ' need your approval</span></div>' +
      '<div class="meta">Verify or edit before they reach your customers.</div></div>' +
      '<button type="button" class="ir-btn ir-btn-sm">Review →</button></div>'
    ) : '';
    el.querySelector('[data-go]')?.addEventListener('click', function () { go('approvals'); });
  }

  function renderAttention() {
    var rows = (state.snapshot && state.snapshot.receivables) || [];
    var items = rows.filter(function (r) { return r.overdueDays > 0; })
      .sort(function (a, b) { return b.overdueDays - a.overdueDays; }).slice(0, 3);
    $('attention').innerHTML = items.length ? items.map(function (inv) {
      return '<div class="ir-field" style="cursor:pointer" data-open="' + esc(inv.id) + '">' +
        '<span><span class="ir-party">' + esc(inv.party) + '</span><br><span class="meta">' +
        esc(inv.id) + ' · ' + esc(inv.stageLabel) + '</span></span>' +
        '<span><span class="ir-amt">' + fmt(inv.amount) + '</span> ' +
        pillHtml('overdue', inv.overdueDays + 'd') + '</span></div>';
    }).join('') : '<div class="ir-empty">All clear.</div>';
  }

  function renderAR() {
    var rows = (state.snapshot && state.snapshot.receivables) || [];
    $('ar-rows').innerHTML = rows.sort(function (a, b) { return b.overdueDays - a.overdueDays; })
      .map(function (inv) {
        var st = inv.overdueDays > 0
          ? pillHtml('overdue', inv.overdueDays + 'd overdue')
          : pillHtml('pending', 'Due ' + dstr(inv.due));
        var next = inv.needsApproval ? 'Awaiting approval' : (inv.stagePill === 'r1_sent' ? 'R1 sent' : '—');
        return '<tr tabindex="0" data-open="' + esc(inv.id) + '"><td class="ir-mono">' + esc(inv.id) +
          '</td><td class="ir-party">' + esc(inv.party) + '</td><td>' + esc(SRC_LABEL[inv.source] || inv.source) +
          '</td><td class="ir-amt">' + fmt(inv.amount) + '</td><td>' + dstr(inv.due) + '</td><td>' + st +
          '</td><td>' + esc(next) + '</td></tr>';
      }).join('');
  }

  function renderAP() {
    var rows = (state.snapshot && state.snapshot.payables) || [];
    $('ap-rows').innerHTML = rows.sort(function (a, b) { return b.overdueDays - a.overdueDays; })
      .map(function (b) {
        var pill = b.overdueDays > 0 ? 'overdue' : 'pending';
        var txt = b.overdueDays > 0 ? b.overdueDays + 'd late' : 'Due ' + dstr(b.due);
        return '<tr><td class="ir-mono">' + esc(b.id) + '</td><td class="ir-party">' + esc(b.party) +
          '</td><td>' + esc(SRC_LABEL[b.source] || b.source) + '</td><td class="ir-amt">' + fmt(b.amount) +
          '</td><td>' + dstr(b.due) + '</td><td>' + pillHtml(pill, txt) + '</td><td>Scheduled</td></tr>';
      }).join('');
  }

  function renderFollowups() {
    var rows = (state.snapshot && state.snapshot.receivables) || [];
    $('fu-rows').innerHTML = rows.filter(function (r) { return r.overdueDays > 0; })
      .sort(function (a, b) { return b.overdueDays - a.overdueDays; })
      .map(function (inv) {
        var mode = inv.needsApproval ? pillHtml('approval', 'Approval') : pillHtml('r1', 'Auto');
        return '<tr tabindex="0" data-open="' + esc(inv.id) + '"><td class="ir-mono">' + esc(inv.id) +
          '</td><td class="ir-party">' + esc(inv.party) + '</td><td>' + pillHtml('overdue', inv.overdueDays + 'd') +
          '</td><td>' + esc(inv.stageLabel) + '</td><td>' + mode + '</td><td>' +
          (inv.channel === 'email' ? 'Email' : 'WhatsApp') + '</td></tr>';
      }).join('');
  }

  function renderCaptured() {
    var rows = (state.snapshot && state.snapshot.captured) || [];
    $('cap-rows').innerHTML = rows.map(function (c) {
      return '<tr><td class="ir-mono">' + esc(c.ref) + '</td><td class="ir-party">' + esc(c.party) +
        '</td><td>' + pillHtml('pending', c.type) + '</td><td>' + esc(SRC_LABEL[c.source] || c.source) +
        '</td><td class="ir-amt">' + fmt(c.amount) + '</td><td>' + esc(c.capturedAt) + '</td></tr>';
    }).join('');
  }

  function renderReview() {
    var rows = (state.snapshot && state.snapshot.review) || [];
    var card = $('review-card');
    if (!rows.length) { card.classList.add('ir-hidden'); return; }
    card.classList.remove('ir-hidden');
    $('review-list').innerHTML = rows.map(function (r) {
      return '<div class="ir-appr-card"><div class="ir-appr-top"><div><span class="who">' + esc(r.party) +
        '</span> <span class="meta">· ' + esc(r.ref) + ' · ' + esc(SRC_LABEL[r.source] || r.source) + '</span></div></div>' +
        '<div class="ir-field"><span class="k">Amount</span><span class="v">' + fmt(r.amount) + '</span></div>' +
        '<div class="ir-field"><span class="k">Due date</span><span class="v">' + dstr(r.due) +
        ' <span class="ir-pill ir-pill--' + (r.dueConf === 'high' ? 'r1' : 'review') + '">' +
        (r.dueConf === 'high' ? 'confident' : 'check') + '</span></span></div>' +
        '<p class="hint">' + esc(r.note) + '</p>' +
        '<div class="ir-appr-actions"><button type="button" class="ir-btn ir-btn-primary ir-btn-sm" data-confirm="' +
        esc(r.tempId) + '">Confirm &amp; add</button></div></div>';
    }).join('');
  }

  function renderApprovals() {
    var list = (state.snapshot && state.snapshot.approvals) || [];
    var el = $('appr-list');
    if (!list.length) {
      el.innerHTML = '<div class="ir-empty">Nothing to approve. Firmer reminders will appear here as invoices age.</div>';
      return;
    }
    el.innerHTML = list.map(function (inv) {
      var riskCls = 'ir-risk-' + (inv.risk || 'soft');
      return '<div class="ir-appr-card" data-id="' + esc(inv.id) + '"><div class="ir-appr-top">' +
        '<div><span class="who">' + esc(inv.party) + '</span> <span class="meta">· ' + esc(inv.id) +
        ' · ' + fmt(inv.amount) + ' · ' + inv.overdueDays + 'd overdue</span></div>' +
        '<span class="ir-risk ' + riskCls + '">' + esc(inv.stageLabel) + '</span></div>' +
        '<div class="ir-chan-toggle" role="group" aria-label="Channel">' +
        '<button type="button" class="' + (inv.channel !== 'email' ? 'is-on' : '') + '" data-chan="wa" data-id="' +
        esc(inv.id) + '">WhatsApp</button>' +
        '<button type="button" class="email ' + (inv.channel === 'email' ? 'is-on' : '') +
        '" data-chan="email" data-id="' + esc(inv.id) + '">Email</button></div>' +
        '<textarea class="ir-appr-msg" id="msg-' + esc(inv.id) + '" aria-label="Message for ' + esc(inv.party) + '">' +
        esc(inv.draft) + '</textarea>' +
        '<div class="ir-appr-actions">' +
        '<button type="button" class="ir-btn ir-btn-green ir-btn-sm" data-approve="' + esc(inv.id) + '">Approve</button>' +
        '<button type="button" class="ir-btn ir-btn-sm" data-snooze="' + esc(inv.id) + '">Snooze 5d</button>' +
        '<button type="button" class="ir-btn ir-btn-sm" data-skip="' + esc(inv.id) + '">Skip</button>' +
        '</div></div>';
    }).join('');
  }

  function renderActivity() {
    var rows = (state.snapshot && state.snapshot.activity) || [];
    var list = $('activity-list');
    if (list) {
      list.innerHTML = rows.length ? rows.map(function (a) {
        return '<div class="ir-field"><span class="k">' + esc(a.timestamp) + '</span><span class="v">' +
          esc(a.ref) + ' · ' + esc(a.event) + (a.detail ? ' — ' + esc(a.detail) : '') + '</span></div>';
      }).join('') : '<div class="ir-empty">No recent activity.</div>';
    }
    var tb = $('activity-rows');
    if (tb) {
      tb.innerHTML = rows.length ? rows.map(function (a) {
        return '<tr><td class="ir-mono">' + esc(a.timestamp) + '</td><td>' + esc(a.ref) +
          '</td><td>' + esc(a.event) + '</td><td>' + esc(a.channel || '—') +
          '</td><td>' + esc(a.detail || '') + '</td></tr>';
      }).join('') : '<tr><td colspan="5" class="ir-empty">No log rows yet.</td></tr>';
    }
  }

  function renderAll() {
    renderBadges();
    renderKPIs();
    renderBanner();
    renderAttention();
    renderAR();
    renderAP();
    renderFollowups();
    renderCaptured();
    renderReview();
    renderApprovals();
    renderActivity();
  }

  function go(view) {
    state.view = view;
    document.querySelectorAll('.ir-view').forEach(function (el) {
      el.classList.toggle('ir-hidden', el.id !== 'view-' + view);
    });
    document.querySelectorAll('[data-view]').forEach(function (btn) {
      var on = btn.getAttribute('data-view') === view;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    var t = VIEWS[view] || VIEWS.overview;
    $('view-title').textContent = t[0];
    $('view-sub').textContent = t[1];
    window.scrollTo(0, 0);
  }

  function bindActions() {
    document.body.addEventListener('click', function (e) {
      var t = e.target.closest('[data-view]');
      if (t) { go(t.getAttribute('data-view')); return; }

      var approve = e.target.closest('[data-approve]');
      if (approve) {
        var id = approve.getAttribute('data-approve');
        var msg = $('msg-' + id);
        var card = approve.closest('.ir-appr-card');
        var ch = card && card.querySelector('.ir-chan-toggle .is-on');
        runAction('approve', { id: id, draft: msg ? msg.value : '', channel: ch && ch.classList.contains('email') ? 'email' : 'wa' });
        return;
      }

      var snooze = e.target.closest('[data-snooze]');
      if (snooze) { runAction('snooze', { id: snooze.getAttribute('data-snooze'), days: 5 }); return; }

      var skip = e.target.closest('[data-skip]');
      if (skip) { runAction('skip', { id: skip.getAttribute('data-skip') }); return; }

      var confirm = e.target.closest('[data-confirm]');
      if (confirm) { runAction('confirmReview', { id: confirm.getAttribute('data-confirm'), fixed: {} }); return; }

      var chan = e.target.closest('[data-chan]');
      if (chan) {
        runAction('setChannel', { id: chan.getAttribute('data-id'), channel: chan.getAttribute('data-chan') });
        return;
      }

      var open = e.target.closest('[data-open]');
      if (open) {
        var inv = (state.snapshot.receivables || []).find(function (r) { return r.id === open.getAttribute('data-open'); });
        if (inv) {
          if (window.confirm('Mark ' + inv.id + ' as paid and stop chasing?')) {
            runAction('markPaid', { id: inv.id });
          }
        }
      }
    });

    $('btn-approve-all')?.addEventListener('click', function () { runAction('approveAll', {}); });
    $('btn-refresh')?.addEventListener('click', function () { loadSnapshot(); });
    $('ir-gate-signin')?.addEventListener('click', signIn);
  }

  async function signIn() {
    var fb = window.phFirebaseAuth;
    if (!fb) { toast('Auth not ready.', true); return; }
    try {
      await fb.signInWithPopup(fb.auth, fb.googleProvider);
      await loadSnapshot();
    } catch (err) {
      if (err && err.code !== 'auth/popup-closed-by-user') toast('Sign-in failed.', true);
    }
  }

  function populateUser(user) {
    if (!user) return;
    $('user-name').textContent = user.displayName || user.email || 'User';
    $('user-email').textContent = user.email || '';
    var av = $('user-avatar');
    if (av) av.textContent = (user.displayName || user.email || 'U').charAt(0).toUpperCase();
  }

  function initAuth() {
    function ready() {
      var fb = window.phFirebaseAuth;
      if (!fb) return;
      fb.onAuthStateChanged(fb.auth, async function (user) {
        state.user = user;
        if (!user) {
          showGate('signin');
          return;
        }
        populateUser(user);
        await loadSnapshot();
      });
    }
    if (window.phFirebaseAuth) ready();
    else window.addEventListener('ph-firebase-ready', ready);
  }

  document.addEventListener('DOMContentLoaded', function () {
    bindActions();
    initAuth();
    go('overview');
  });
})();
