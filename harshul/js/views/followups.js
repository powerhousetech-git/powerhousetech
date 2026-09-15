/**
 * Follow-Ups view — calendar-based, per selected date.
 * Stats + Overdue/Due/Completed sections + Mark Done modal + Send All Reminders.
 */
(function (global) {
  'use strict';
  var U = global.HRSUtil, API = global.HRSApi;

  function render(ctx) {
    var esc = ctx.esc, st = ctx.state, sel = st.fu.selectedDate, today = U.todayKey();

    var overdue = [], due = [], done = [];
    st.clients.forEach(function (c) {
      var k = U.parseDateKey(c.follow_up_date); if (!k) return;
      if (k === sel) { (U.isDone(c.status) ? done : due).push(c); }
      else if (U.dayDiff(sel, k) > 0 && !U.isDone(c.status)) overdue.push(c);
    });
    overdue.sort(function (a, b) { return U.parseDateKey(a.follow_up_date) < U.parseDateKey(b.follow_up_date) ? -1 : 1; });

    var total = due.length + done.length;
    var stats = [
      ['Total', total, 'brand'], ['Done', done.length, 'green'],
      ['Pending', due.length, 'amber'], ['Overdue', overdue.length, overdue.length > 0 ? 'red' : 'green'],
    ].map(function (c) {
      return '<div class="kpi kpi-' + c[2] + '"><div class="kpi-label">' + esc(c[0]) + '</div><div class="kpi-value">' + esc(String(c[1])) + '</div></div>';
    }).join('');

    var nav =
      '<div class="date-nav">' +
      '<button class="btn btn-ghost btn-sm" id="fu-prev">◀ Yesterday</button>' +
      '<div class="date-label">' + esc(U.dateNavLabel(sel)) +
      (sel !== today ? ' <button class="btn btn-sm btn-ghost" id="fu-today">Today</button>' : '') + '</div>' +
      '<button class="btn btn-ghost btn-sm" id="fu-next">Tomorrow ▶</button>' +
      '<input type="date" id="fu-pick" class="input" value="' + esc(sel) + '">' +
      '</div>';

    ctx.main().innerHTML =
      ctx.pageHead('Follow-Ups', null, '<button class="btn btn-amber" id="fu-remind">🔔 Send All Reminders</button>') +
      '<div class="card">' + nav + '</div>' +
      '<div class="kpi-row kpi-4">' + stats + '</div>' +
      section('Overdue', overdue.length, 'red', overdue.map(function (c) { return fuCard(c, sel, esc, true); }).join(''), overdue.length) +
      section('Due ' + (sel === today ? 'Today' : 'on ' + U.fmtDayShort(sel)), due.length, 'amber', due.map(function (c) { return fuCard(c, sel, esc, false); }).join(''), due.length) +
      completedSection(done, esc);

    // Nav handlers
    ctx.main().querySelector('#fu-prev').addEventListener('click', function () { st.fu.selectedDate = U.addDays(sel, -1); render(ctx); });
    ctx.main().querySelector('#fu-next').addEventListener('click', function () { st.fu.selectedDate = U.addDays(sel, 1); render(ctx); });
    var tb = ctx.main().querySelector('#fu-today'); if (tb) tb.addEventListener('click', function () { st.fu.selectedDate = today; render(ctx); });
    ctx.main().querySelector('#fu-pick').addEventListener('change', function () { if (this.value) { st.fu.selectedDate = this.value; render(ctx); } });
    ctx.main().querySelector('#fu-remind').addEventListener('click', function () { sendReminders(ctx, this); });
    bindMarkDone(ctx);
  }

  function section(title, count, tone, inner, has) {
    if (!has) return '';
    return '<div class="card fu-section"><div class="fu-head"><h3>' + title +
      '</h3><span class="count-pill count-' + tone + '">' + count + '</span></div>' + inner + '</div>';
  }

  function fuCard(c, sel, esc, isOverdue) {
    var k = U.parseDateKey(c.follow_up_date);
    var days = U.dayDiff(sel, k);
    var dot = isOverdue ? U.overdueDot(days) : '🟡';
    var tone = isOverdue ? U.overdueTone(days) : 'today';
    var dueLine = isOverdue ? ('Due: ' + esc(U.fmtDate(c.follow_up_date)) + ' (' + days + ' day' + (days === 1 ? '' : 's') + ' overdue)') : 'Due: Today';
    return '<div class="fu-row fu-' + tone + '">' +
      '<div class="fu-main"><div class="cell-strong">' + esc(dot) + ' ' + esc(c.customer_name || '—') + '</div>' +
      '<div class="cell-sub">' + esc(U.fmtPhone(c.phone)) + ' · ' + esc(c.product || '—') + (c.assigned_to ? ' · ' + esc(c.assigned_to) : '') + '</div>' +
      (c.notes ? '<div class="cell-sub">Notes: “' + esc(c.notes) + '”</div>' : '') +
      '<div class="cell-sub due">' + dueLine + '</div></div>' +
      '<div class="fu-side"><button class="btn btn-sm btn-primary" data-done="' + esc(c.phone) + '" data-name="' + esc(c.customer_name) + '">Mark Done</button></div>' +
      '</div>';
  }

  function completedSection(done, esc) {
    if (!done.length) return '';
    var items = done.map(function (c) {
      var verb = U.normStatus(c.status) === 'cancelled' ? 'cancelled' : 'marked done';
      return '<li>✅ ' + esc(c.customer_name || '—') + ' — ' + verb + (c.assigned_to ? ' · ' + esc(c.assigned_to) : '') + '</li>';
    }).join('');
    return '<details class="card fu-section"><summary class="fu-head"><h3>Completed</h3>' +
      '<span class="count-pill count-green">' + done.length + '</span></summary>' +
      '<ul class="completed-list">' + items + '</ul></details>';
  }

  function clientByPhone(ctx, phone) {
    return ctx.state.clients.find(function (c) { return U.normPhone(c.phone) === U.normPhone(phone); });
  }

  function bindMarkDone(ctx) {
    ctx.main().querySelectorAll('[data-done]').forEach(function (b) {
      b.addEventListener('click', function () { openMarkDone(ctx, b.getAttribute('data-done'), b.getAttribute('data-name')); });
    });
  }

  function openMarkDone(ctx, phone, name) {
    var esc = ctx.esc;
    ctx.openModal(
      '<div class="modal-head"><h3>Mark Follow-Up Done</h3><button class="icon-btn" data-x>✕</button></div>' +
      '<div class="modal-body">' +
      (name ? '<p class="hint">Customer: <b>' + esc(name) + '</b> · ' + esc(U.fmtPhone(phone)) + '</p>' : '') +
      '<label class="fld">Status<select id="md-status" class="input">' +
      '<option value="completed">Completed</option><option value="cancelled">Cancelled</option><option value="rescheduled">Rescheduled</option>' +
      '</select></label>' +
      '<label class="fld" id="md-date-wrap" style="display:none">New follow-up date<input type="date" id="md-date" class="input" value="' + esc(U.addDays(U.todayKey(), 3)) + '"></label>' +
      '<label class="fld">Notes<textarea id="md-notes" class="input" rows="3" placeholder="e.g. Customer confirmed delivery"></textarea></label>' +
      '</div>' +
      '<div class="modal-foot"><button class="btn btn-ghost" data-x>Cancel</button><button class="btn btn-primary" id="md-save">Save</button></div>'
    );
    var statusSel = document.getElementById('md-status');
    statusSel.addEventListener('change', function () {
      document.getElementById('md-date-wrap').style.display = this.value === 'rescheduled' ? 'block' : 'none';
    });
    document.getElementById('md-save').addEventListener('click', async function () {
      var status = statusSel.value;
      var notes = document.getElementById('md-notes').value.trim();
      var newDate = document.getElementById('md-date').value;
      if (status === 'completed' && !notes) { ctx.toast('Notes are required to complete', 'err'); return; }
      var body = { phone: U.normPhone(phone), status: status, notes: notes };
      if (status === 'rescheduled') body.new_follow_up_date = newDate;
      ctx.setBusy(this, true, 'Saving…');
      var res = await API.triggerWorkflow('mark_done', body);
      ctx.setBusy(this, false);
      if (res.ok) {
        var c = clientByPhone(ctx, phone);
        if (c) {
          if (status === 'rescheduled') { c.status = 'rescheduled'; c.follow_up_date = newDate; }
          else c.status = status;
        }
        U.logActivity({ icon: status === 'cancelled' ? '🚫' : (status === 'rescheduled' ? '📅' : '✓'), tone: status === 'completed' ? 'green' : (status === 'cancelled' ? 'red' : 'teal'), text: 'Follow-up ' + status + ' for ' + (name || U.fmtPhone(phone)) });
        ctx.toast('Follow-up updated', 'ok');
        ctx.closeModal(); render(ctx);
      } else { ctx.webhookMiss(res, 'Mark done'); }
    });
  }

  async function sendReminders(ctx, btn) {
    ctx.setBusy(btn, true, 'Sending…');
    var res = await API.triggerWorkflow('trigger_followup', { date: ctx.state.fu.selectedDate });
    ctx.setBusy(btn, false);
    if (res.ok) {
      var n = res.data && (res.data.remindersSent != null ? res.data.remindersSent : res.data.reminders);
      U.logActivity({ icon: '⏰', tone: 'amber', text: 'Sent follow-up reminders' + (n != null ? ' (' + n + ')' : '') });
      ctx.toast('Reminders sent' + (n != null ? ': ' + n : ''), 'ok');
    } else { ctx.webhookMiss(res, 'Send reminders'); }
  }

  (global.HRSViews = global.HRSViews || {}).followups = render;
})(window);
