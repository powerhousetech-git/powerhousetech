/**
 * Home view — read-only status screen.
 * 3 stat cards + recent activity feed. No actions.
 */
(function (global) {
  'use strict';
  var U = global.HRSUtil, API = global.HRSApi;

  function render(ctx) {
    var esc = ctx.esc;
    var s = API.computeHomeStats(ctx.state.clients, ctx.state.messages);
    var cards = [
      ['Messages Sent Today', s.sentToday, 'teal'],
      ['Follow-Ups Due Today', s.dueToday, 'brand'],
      ['Overdue Follow-Ups', s.overdue, s.overdue > 0 ? 'red' : 'green'],
    ].map(function (c) {
      return '<div class="kpi kpi-' + c[2] + '"><div class="kpi-label">' + esc(c[0]) +
        '</div><div class="kpi-value">' + esc(String(c[1])) + '</div></div>';
    }).join('');

    var acts = API.buildActivity(ctx.state.clients, ctx.state.messages);
    var feed = acts.length ? acts.map(function (a) {
      return '<li><span class="act-icon">' + esc(a.icon) + '</span>' +
        '<span class="act-text">' + esc(a.text) + '</span>' +
        '<span class="act-time">' + esc(U.relTime(a.ts)) + '</span></li>';
    }).join('') : '<li class="muted">No recent activity yet.</li>';

    ctx.main().innerHTML =
      ctx.pageHead('Harshul Tiles & Fittings', 'Post-sale automation & follow-up monitor') +
      '<div class="kpi-row kpi-3">' + cards + '</div>' +
      '<div class="card"><h3>Recent Activity</h3><ul class="activity">' + feed + '</ul></div>';
  }

  (global.HRSViews = global.HRSViews || {}).home = render;
})(window);
