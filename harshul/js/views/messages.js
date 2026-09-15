/**
 * Messages view — post-sale message pipeline (5-step journey per customer).
 * Monitoring only, except switching a customer's upsell pattern.
 */
(function (global) {
  'use strict';
  var CFG = global.HRS, U = global.HRSUtil, API = global.HRSApi;

  // Indicator for one stage of one customer.
  function stageState(msg) {
    if (!msg) return { sym: '·', cls: 'st-idle' };
    var today = U.todayKey();
    switch (msg.status) {
      case 'sent': return { sym: '✅', cls: 'st-sent' };
      case 'failed': return { sym: '❌', cls: 'st-failed' };
      case 'opted_out': return { sym: '🚫', cls: 'st-opted' };
      default: // pending
        var k = U.parseDateKey(msg.scheduled_date);
        var due = k && U.dayDiff(today, k) >= 0;
        return due ? { sym: '⏳', cls: 'st-pending' } : { sym: '·', cls: 'st-idle' };
    }
  }

  function summary(messages) {
    var sent = 0, pending = 0, failed = 0;
    messages.forEach(function (m) {
      if (m.status === 'sent') sent++;
      else if (m.status === 'failed') failed++;
      else if (m.status === 'pending') pending++;
    });
    return { sent: sent, pending: pending, failed: failed };
  }

  function matchFilter(g, f) {
    var stages = CFG.MESSAGE_STAGES.map(function (st) { return g.stages[st.key]; });
    var allSent = stages.every(function (m) { return m && m.status === 'sent'; });
    var anyPending = stages.some(function (m) { return m && m.status === 'pending'; });
    var anyFailed = stages.some(function (m) { return m && m.status === 'failed'; });
    if (f.status === 'completed' && !allSent) return false;
    if (f.status === 'in_progress' && (allSent || !anyPending)) return false;
    if (f.status === 'failures' && !anyFailed) return false;
    if (f.product !== 'all' && g.product !== f.product) return false;
    return true;
  }

  function card(g, esc) {
    var stages = CFG.MESSAGE_STAGES.map(function (st) {
      var s = stageState(g.stages[st.key]);
      return '<div class="step ' + s.cls + '"><div class="step-sym">' + s.sym + '</div>' +
        '<div class="step-day">Day ' + st.day + '</div><div class="step-label">' + esc(st.label) + '</div></div>';
    }).join('<div class="step-sep"></div>');

    var allSent = CFG.MESSAGE_STAGES.every(function (st) { var m = g.stages[st.key]; return m && m.status === 'sent'; });
    var isCust = g.upsell_pattern === 'customised';
    var sel = '<select class="mini-select" data-upsell="' + esc(g.phone) + '">' +
      '<option value="default"' + (isCust ? '' : ' selected') + '>Default</option>' +
      '<option value="customised"' + (isCust ? ' selected' : '') + '>Customised</option></select>';

    var custBox = isCust ?
      '<div class="upsell-box" data-upsell-box="' + esc(g.phone) + '">' +
      '<label class="fld">Upsell product / message' +
      '<textarea class="input" data-upsell-msg="' + esc(g.phone) + '" rows="2" placeholder="e.g. Bought floor tiles → upsell grout, tile cleaner, wall tiles">' + esc(g.upsell_custom_message || '') + '</textarea></label>' +
      '<div class="upsell-actions"><button class="btn btn-sm btn-primary" data-upsell-save="' + esc(g.phone) + '">Save</button></div>' +
      '</div>' : '';

    return '<div class="pcard">' +
      '<div class="pcard-head"><div><div class="cell-strong">' + esc(g.name || '—') + '</div>' +
      '<div class="cell-sub">' + esc(U.fmtPhone(g.phone)) + ' · ' + esc(g.product || '—') +
      (g.sale_date ? ' · Bought ' + esc(U.fmtDate(g.sale_date)) : '') + '</div></div>' +
      '<div class="pcard-upsell">' + sel + '</div></div>' +
      '<div class="pipeline' + (allSent ? ' pipeline-done' : '') + '">' + stages + '</div>' +
      (allSent ? '<div class="pipe-complete">Journey complete</div>' : '') +
      custBox +
      '</div>';
  }

  function render(ctx) {
    var esc = ctx.esc, st = ctx.state, f = st.msg;
    var sum = summary(st.messages);
    var products = {}; st.grouped.forEach(function (g) { if (g.product) products[g.product] = 1; });
    var prodOpts = ['<option value="all">All products</option>'].concat(Object.keys(products).sort().map(function (p) {
      return '<option value="' + esc(p) + '"' + (f.product === p ? ' selected' : '') + '>' + esc(p) + '</option>';
    })).join('');
    var statusOpts = [['all', 'All'], ['in_progress', 'In Progress'], ['completed', 'Completed'], ['failures', 'Has Failures']]
      .map(function (o) { return '<option value="' + o[0] + '"' + (f.status === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('');

    var rows = st.grouped.filter(function (g) { return matchFilter(g, f); });
    var cards = rows.length ? rows.map(function (g) { return card(g, esc); }).join('') :
      '<p class="muted center">No customers match.</p>';

    ctx.main().innerHTML =
      ctx.pageHead('Message Pipeline', 'Automated post-sale messages') +
      '<div class="card">' +
      '<p class="summary-line">' + st.grouped.length + ' customers · ' + sum.sent + ' sent · ' + sum.pending + ' pending · ' + sum.failed + ' failed</p>' +
      '<div class="toolbar"><select id="mf-status" class="input">' + statusOpts + '</select>' +
      '<select id="mf-product" class="input">' + prodOpts + '</select></div>' +
      '</div>' +
      '<div class="pcards">' + cards + '</div>';

    ctx.main().querySelector('#mf-status').addEventListener('change', function () { f.status = this.value; render(ctx); });
    ctx.main().querySelector('#mf-product').addEventListener('change', function () { f.product = this.value; render(ctx); });
    bind(ctx);
  }

  function groupByPhone(ctx, phone) {
    return ctx.state.grouped.find(function (g) { return g.phone === U.normPhone(phone); });
  }

  function bind(ctx) {
    var root = ctx.main();
    root.querySelectorAll('[data-upsell]').forEach(function (sel) {
      sel.addEventListener('change', async function () {
        var phone = sel.getAttribute('data-upsell'), val = sel.value;
        var g = groupByPhone(ctx, phone); if (!g) return;
        if (val === 'customised') { g.upsell_pattern = 'customised'; render(ctx); return; }
        // Switch to default → save immediately.
        await save(ctx, phone, 'default', '', sel);
      });
    });
    root.querySelectorAll('[data-upsell-save]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var phone = btn.getAttribute('data-upsell-save');
        var ta = root.querySelector('[data-upsell-msg="' + cssq(phone) + '"]');
        var msg = ta ? ta.value.trim() : '';
        if (!msg) { ctx.toast('Enter an upsell message first', 'err'); return; }
        save(ctx, phone, 'customised', msg, btn);
      });
    });
  }
  function cssq(s) { return String(s).replace(/"/g, '\\"'); }

  async function save(ctx, phone, pattern, msg, btn) {
    ctx.setBusy(btn, true, pattern === 'default' ? 'Saving…' : 'Saving…');
    var res = await API.triggerWorkflow('update_upsell', { phone: U.normPhone(phone), upsell_pattern: pattern, upsell_custom_message: msg });
    ctx.setBusy(btn, false);
    if (res.ok) {
      var g = groupByPhone(ctx, phone);
      if (g) { g.upsell_pattern = pattern; g.upsell_custom_message = msg; }
      // Reflect on underlying message rows too.
      ctx.state.messages.forEach(function (m) { if (U.normPhone(m.customer_phone) === U.normPhone(phone)) { m.upsell_pattern = pattern; if (m.message_type === 'upsell') m.upsell_custom_message = msg; } });
      U.logActivity({ icon: '⚙️', tone: 'teal', text: 'Upsell set to ' + pattern + ' for ' + (g ? g.name : U.fmtPhone(phone)) });
      ctx.toast('Upsell pattern updated', 'ok');
      render(ctx);
    } else {
      ctx.webhookMiss(res, 'Update upsell');
      render(ctx); // revert dropdown to stored value
    }
  }

  (global.HRSViews = global.HRSViews || {}).messages = render;
})(window);
