/**
 * Home view — read-only status screen.
 * Stage breakdown + Deals-Closed leaderboard + secondary KPIs + activity feed.
 */
(function (global) {
  'use strict';
  var U = global.HRSUtil, API = global.HRSApi;

  function stageCards(clients, esc) {
    return API.computeStageStats(clients).map(function (s) {
      return '<div class="stage-stat stage-' + s.stage + '">' +
        '<div class="stage-count">' + esc(String(s.count)) + '</div>' +
        '<div class="stage-name">' + esc(U.statusLabel(s.stage)) + '</div></div>';
    }).join('');
  }

  function leaderboard(clients, esc) {
    var rows = API.computeLeaderboard(clients).filter(function (e) { return e.dealsClosed > 0 || e.total > 0; });
    if (!rows.length) return '<p class="muted">No leads yet.</p>';
    var body = rows.map(function (e, i) {
      return '<tr><td class="rank">' + (i + 1) + '</td>' +
        '<td class="lead-name">' + esc(e.employee) + '</td>' +
        '<td class="num deals">' + esc(String(e.dealsClosed)) + '</td>' +
        '<td class="num">' + esc(String(e.total)) + '</td></tr>';
    }).join('');
    return '<table class="leaderboard"><thead><tr>' +
      '<th class="rank">#</th><th>Employee</th><th class="num">Deals Closed</th><th class="num">Leads Handled</th>' +
      '</tr></thead><tbody>' + body + '</tbody></table>';
  }

  function render(ctx) {
    var esc = ctx.esc, clients = ctx.state.clients;
    var s = API.computeHomeStats(clients, ctx.state.messages);

    var secondary = [
      ['Overdue Follow-Ups', s.overdue, s.overdue > 0 ? 'red' : 'green'],
      ['Messages Sent Today', s.sentToday, 'teal'],
    ].map(function (c) {
      return '<div class="kpi kpi-' + c[2] + '"><div class="kpi-label">' + esc(c[0]) +
        '</div><div class="kpi-value">' + esc(String(c[1])) + '</div></div>';
    }).join('');

    var acts = API.buildActivity(clients, ctx.state.messages);
    var feed = acts.length ? acts.map(function (a) {
      return '<li><span class="act-icon">' + esc(a.icon) + '</span>' +
        '<span class="act-text">' + esc(a.text) + '</span>' +
        '<span class="act-time">' + esc(U.relTime(a.ts)) + '</span></li>';
    }).join('') : '<li class="muted">No recent activity yet.</li>';

    ctx.main().innerHTML =
      ctx.pageHead('Harshul Tiles & Fittings', 'Lead pipeline & post-sale automation monitor') +
      '<div class="card"><h3>Lead Stage Breakdown</h3><div class="stage-grid">' + stageCards(clients, esc) + '</div></div>' +
      '<div class="card"><h3>Employee Leaderboard — Deals Closed</h3>' + leaderboard(clients, esc) + '</div>' +
      '<div class="kpi-row kpi-2">' + secondary + '</div>' +
      '<div class="card"><h3>Recent Activity</h3><ul class="activity">' + feed + '</ul></div>';
  }

  (global.HRSViews = global.HRSViews || {}).home = render;
})(window);
