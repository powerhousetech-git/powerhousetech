/**
 * Leads view (Section 1) — the walk-in lead master, 7-stage model.
 * Search + category/employee filters + Send All Reminders. Each lead shows
 * its stage badge, follow-up date with overdue indicator, employee + admin
 * remarks and the AI next-step, and is editable via the Update modal
 * (category / follow-up date / admin remark → hrs-update-lead webhook).
 */
(function (global) {
  'use strict';
  var CFG = global.HRS, U = global.HRSUtil, API = global.HRSApi;
  var _qTimer = null;

  function overdueInfo(c, refKey) {
    // Only non-terminal leads can be overdue. Overdue is measured against
    // refKey (default = today), so the date navigator can view any date.
    if (U.isClosedStage(c.status)) return null;
    var k = U.parseDateKey(c.follow_up_date);
    if (!k) return null;
    var days = U.dayDiff(refKey || U.todayKey(), k); // ref - due; +ve = overdue
    if (days <= 0) return null;
    return { days: days, dot: U.overdueDot(days), tone: U.overdueTone(days) };
  }

  function matches(c, f) {
    if (f.category !== 'all' && U.normStatus(c.status) !== f.category) return false;
    if (f.employee !== 'all' && String(c.assigned_to || '').trim() !== f.employee) return false;
    if (f.q) {
      var hay = (String(c.customer_name || '') + ' ' + String(c.phone || '')).toLowerCase();
      if (hay.indexOf(f.q.toLowerCase()) < 0) return false;
    }
    return true;
  }

  function leadCard(c, esc, refKey) {
    var od = overdueInfo(c, refKey);
    var toneCls = od ? ' lead-' + od.tone : '';

    var dueKey = U.parseDateKey(c.follow_up_date);
    var dueLine;
    if (U.isClosedStage(c.status)) {
      dueLine = 'Follow-up: — (' + esc(U.statusLabel(c.status).toLowerCase()) + ')';
    } else if (!dueKey) {
      dueLine = 'Follow-up: —';
    } else if (od) {
      dueLine = od.dot + ' Follow-up: ' + esc(U.fmtDate(c.follow_up_date)) +
        ' (' + od.days + ' day' + (od.days === 1 ? '' : 's') + ' overdue)';
    } else {
      dueLine = 'Follow-up: ' + esc(U.fmtDate(c.follow_up_date));
    }

    var meta = esc(U.fmtPhone(c.phone)) + ' · ' + esc(c.product || '—') +
      (c.assigned_to ? ' · ' + esc(c.assigned_to) : '');

    return '<div class="lead-card' + toneCls + '">' +
      '<div class="lead-main">' +
      '<div class="lead-top">' + U.statusBadge(c.status) +
      '<span class="lead-name">' + esc(c.customer_name || '—') + '</span></div>' +
      '<div class="lead-meta">' + meta + '</div>' +
      '<div class="lead-line due">' + dueLine + '</div>' +
      (c.notes ? '<div class="lead-line remark">📝 ' + esc(c.notes) + '</div>' : '') +
      (c.admin_remark ? '<div class="lead-line admin">🛡️ Admin: ' + esc(c.admin_remark) + '</div>' : '') +
      (c.next_step ? '<div class="lead-next">➡️ Next: ' + esc(c.next_step) + '</div>' : '') +
      '</div>' +
      '<div class="lead-side"><button class="btn btn-sm btn-primary" data-update="' + esc(c.phone) + '">Update</button></div>' +
      '</div>';
  }

  function section(title, tone, cards, count) {
    if (!count) return '';
    return '<div class="card leads-section"><div class="fu-head"><h3>' + title +
      '</h3><span class="count-pill count-' + tone + '">' + count + '</span></div>' + cards + '</div>';
  }

  function kpi(label, val, tone) {
    return '<div class="kpi kpi-' + tone + '"><div class="kpi-label">' + label +
      '</div><div class="kpi-value">' + val + '</div></div>';
  }

  function render(ctx) {
    var esc = ctx.esc, st = ctx.state, f = st.leads;
    if (!f.selectedDate) f.selectedDate = U.todayKey();
    var sel = f.selectedDate, today = U.todayKey();

    var list = st.clients.filter(function (c) { return matches(c, f); });

    // Date-driven follow-up buckets (non-terminal), relative to the selected date.
    var overdueSel = [], dueSel = [];
    list.forEach(function (c) {
      if (U.isClosedStage(c.status)) return;
      var k = U.parseDateKey(c.follow_up_date); if (!k) return;
      var d = U.dayDiff(sel, k); // sel - due; +ve = overdue as of sel
      if (d > 0) overdueSel.push(c);
      else if (d === 0) dueSel.push(c);
    });
    overdueSel.sort(function (a, b) {
      return U.dayDiff(sel, U.parseDateKey(b.follow_up_date)) - U.dayDiff(sel, U.parseDateKey(a.follow_up_date));
    });
    var activeCount = list.filter(function (c) { return !U.isClosedStage(c.status); }).length;
    var dayLabel = sel === today ? 'Today' : U.fmtDayShort(sel);

    // Filters
    var catOpts = ['<option value="all">All categories</option>'].concat(CFG.STAGES.map(function (s) {
      return '<option value="' + s + '"' + (f.category === s ? ' selected' : '') + '>' + esc(U.statusLabel(s)) + '</option>';
    })).join('');
    var empNames = {};
    st.clients.forEach(function (c) { var e = String(c.assigned_to || '').trim(); if (e) empNames[e] = 1; });
    var empOpts = ['<option value="all">All employees</option>'].concat(Object.keys(empNames).sort().map(function (e) {
      return '<option value="' + esc(e) + '"' + (f.employee === e ? ' selected' : '') + '>' + esc(e) + '</option>';
    })).join('');

    // Date navigator (Yesterday / label / Tomorrow + pick a date).
    var nav =
      '<div class="date-nav">' +
      '<button class="btn btn-ghost btn-sm" id="lead-prev">◀ Yesterday</button>' +
      '<div class="date-label">' + esc(U.dateNavLabel(sel)) +
      (sel !== today ? ' <button class="btn btn-sm btn-ghost" id="lead-today">Today</button>' : '') + '</div>' +
      '<button class="btn btn-ghost btn-sm" id="lead-next">Tomorrow ▶</button>' +
      '<input type="date" id="lead-pick" class="input" value="' + esc(sel) + '">' +
      '</div>';

    var stats = '<div class="kpi-row kpi-3">' +
      kpi('Due ' + esc(dayLabel), dueSel.length, 'amber') +
      kpi('Overdue as of ' + esc(dayLabel), overdueSel.length, overdueSel.length ? 'red' : 'green') +
      kpi('Active leads', activeCount, 'brand') +
      '</div>';

    var overdueHtml = section('🔴 Overdue — as of ' + esc(dayLabel), 'red',
      overdueSel.map(function (c) { return leadCard(c, esc, sel); }).join(''), overdueSel.length);
    var dueHtml = section('🟡 Due ' + esc(dayLabel), 'today',
      dueSel.map(function (c) { return leadCard(c, esc, sel); }).join(''), dueSel.length);
    var followBody = (overdueHtml + dueHtml) ||
      '<div class="card"><p class="muted center">No pending follow-ups ' +
      (sel === today ? 'due today or overdue' : 'for ' + esc(dayLabel)) + '. 🎉</p></div>';

    // Full lead browser grouped by category (collapsible), relative to today.
    var stageSections = CFG.STAGES.map(function (stage) {
      var group = list.filter(function (c) { return U.normStatus(c.status) === stage; });
      if (!group.length) return '';
      var tone = stage === 'deal_closed' ? 'green' : (stage === 'not_interested' ? 'red' : 'today');
      return section(U.statusLabel(stage), tone,
        group.map(function (c) { return leadCard(c, esc); }).join(''), group.length);
    }).join('');
    var allHtml = stageSections ?
      '<details class="leads-all"><summary class="leads-all-sum">All leads by category ' +
      '<span class="count-pill count-brand">' + list.length + '</span></summary>' + stageSections + '</details>' : '';

    ctx.main().innerHTML =
      ctx.pageHead('Leads', 'Walk-in lead master · ' + st.clients.length + ' leads',
        '<button class="btn btn-amber" id="lead-remind">🔔 Send All Reminders</button>') +
      '<div class="card">' +
      '<div class="toolbar">' +
      '<input type="search" id="lead-q" class="input" placeholder="Search name or phone" value="' + esc(f.q || '') + '">' +
      '<select id="lead-cat" class="input">' + catOpts + '</select>' +
      '<select id="lead-emp" class="input">' + empOpts + '</select>' +
      '</div>' + nav +
      '</div>' +
      stats + followBody + allHtml;

    var q = ctx.main().querySelector('#lead-q');
    q.addEventListener('input', function () {
      f.q = this.value;
      clearTimeout(_qTimer);
      _qTimer = setTimeout(function () { renderKeepFocus(ctx); }, 220);
    });
    ctx.main().querySelector('#lead-cat').addEventListener('change', function () { f.category = this.value; render(ctx); });
    ctx.main().querySelector('#lead-emp').addEventListener('change', function () { f.employee = this.value; render(ctx); });
    ctx.main().querySelector('#lead-remind').addEventListener('click', function () { sendReminders(ctx, this); });
    // Date navigation
    ctx.main().querySelector('#lead-prev').addEventListener('click', function () { f.selectedDate = U.addDays(sel, -1); render(ctx); });
    ctx.main().querySelector('#lead-next').addEventListener('click', function () { f.selectedDate = U.addDays(sel, 1); render(ctx); });
    var tbtn = ctx.main().querySelector('#lead-today'); if (tbtn) tbtn.addEventListener('click', function () { f.selectedDate = today; render(ctx); });
    ctx.main().querySelector('#lead-pick').addEventListener('change', function () { if (this.value) { f.selectedDate = this.value; render(ctx); } });
    bindUpdate(ctx);
  }

  // Re-render but keep the search box focused + caret at end (typing UX).
  function renderKeepFocus(ctx) {
    render(ctx);
    var q = ctx.main().querySelector('#lead-q');
    if (q) { q.focus(); var v = q.value; q.value = ''; q.value = v; }
  }

  function clientByPhone(ctx, phone) {
    return ctx.state.clients.find(function (c) { return U.normPhone(c.phone) === U.normPhone(phone); });
  }

  function bindUpdate(ctx) {
    ctx.main().querySelectorAll('[data-update]').forEach(function (b) {
      b.addEventListener('click', function () { openUpdate(ctx, b.getAttribute('data-update')); });
    });
  }

  function openUpdate(ctx, phone) {
    var esc = ctx.esc;
    var c = clientByPhone(ctx, phone);
    if (!c) return;
    var cur = U.normStatus(c.status);
    var curDate = U.parseDateKey(c.follow_up_date) || '';

    var catOpts = CFG.STAGES.map(function (s) {
      return '<option value="' + s + '"' + (cur === s ? ' selected' : '') + '>' + esc(U.statusLabel(s)) + '</option>';
    }).join('');

    ctx.openModal(
      '<div class="modal-head"><h3>Update Lead</h3><button class="icon-btn" data-x>✕</button></div>' +
      '<div class="modal-body">' +
      '<p class="hint">Customer: <b>' + esc(c.customer_name || '—') + '</b> · ' + esc(U.fmtPhone(phone)) + '</p>' +
      '<label class="fld">Category<select id="ul-cat" class="input">' + catOpts + '</select></label>' +
      '<label class="fld">Follow-up date<input type="date" id="ul-date" class="input" value="' + esc(curDate) + '"></label>' +
      '<label class="fld">Admin remark<textarea id="ul-admin" class="input" rows="3" placeholder="Internal note visible on the dashboard">' + esc(c.admin_remark || '') + '</textarea></label>' +
      '</div>' +
      '<div class="modal-foot"><button class="btn btn-ghost" data-x>Cancel</button><button class="btn btn-primary" id="ul-save">Save</button></div>'
    );

    document.getElementById('ul-save').addEventListener('click', async function () {
      var newCat = document.getElementById('ul-cat').value;
      var newDate = document.getElementById('ul-date').value || '';
      var newAdmin = document.getElementById('ul-admin').value.trim();

      var body = { phone: U.normPhone(phone) };
      if (newCat !== cur) body.status = newCat;
      if (newDate !== curDate) body.follow_up_date = newDate;
      if (newAdmin !== String(c.admin_remark || '').trim()) body.admin_remark = newAdmin;

      var changed = Object.keys(body).filter(function (k) { return k !== 'phone'; });
      if (!changed.length) { ctx.toast('No changes to save', ''); ctx.closeModal(); return; }

      ctx.setBusy(this, true, 'Saving…');
      var res = await API.triggerWorkflow('update_lead', body);
      ctx.setBusy(this, false);
      if (res.ok) {
        if (body.status != null) c.status = body.status;
        if (body.follow_up_date != null) c.follow_up_date = body.follow_up_date;
        if (body.admin_remark != null) c.admin_remark = body.admin_remark;
        U.logActivity({ icon: '📋', tone: 'teal', text: 'Lead updated (' + changed.join(', ') + ') for ' + (c.customer_name || U.fmtPhone(phone)) });
        ctx.toast('Lead updated', 'ok');
        ctx.closeModal();
        render(ctx);
      } else {
        ctx.webhookMiss(res, 'Update lead');
      }
    });
  }

  async function sendReminders(ctx, btn) {
    ctx.setBusy(btn, true, 'Sending…');
    var res = await API.triggerWorkflow('trigger_followup', { date: (ctx.state.leads && ctx.state.leads.selectedDate) || U.todayKey() });
    ctx.setBusy(btn, false);
    if (res.ok) {
      var n = res.data && (res.data.remindersSent != null ? res.data.remindersSent : res.data.reminders);
      U.logActivity({ icon: '⏰', tone: 'amber', text: 'Sent follow-up reminders' + (n != null ? ' (' + n + ')' : '') });
      ctx.toast('Reminders sent' + (n != null ? ': ' + n : ''), 'ok');
    } else { ctx.webhookMiss(res, 'Send reminders'); }
  }

  (global.HRSViews = global.HRSViews || {}).leads = render;
})(window);
