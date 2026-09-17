/**
 * Harshul dashboard — shared helpers (IST dates, statuses, phones).
 * Loaded after config.js.
 */
(function (global) {
  'use strict';

  var TZ = (global.HRS && global.HRS.TZ) || 'Asia/Kolkata';

  // ── Text ────────────────────────────────────────────────────
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ── Status ──────────────────────────────────────────────────
  function normStatus(s) {
    s = String(s || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    var aliases = {
      inprogress: 'in_progress', progress: 'in_progress', ongoing: 'in_progress',
      done: 'completed', complete: 'completed', closed: 'completed',
      cancel: 'cancelled', canceled: 'cancelled', reschedule: 'rescheduled', '': 'new',
    };
    return aliases[s] || s || 'new';
  }
  function isDone(s) { s = normStatus(s); return s === 'completed' || s === 'cancelled'; }
  var STATUS_LABELS = {
    new: 'New', in_progress: 'In Progress', completed: 'Completed',
    cancelled: 'Cancelled', rescheduled: 'Rescheduled',
  };
  function statusLabel(s) {
    s = normStatus(s);
    return STATUS_LABELS[s] || (s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' '));
  }
  function statusBadge(s) {
    var n = normStatus(s);
    return '<span class="badge badge-' + n + '">' + esc(statusLabel(n)) + '</span>';
  }

  // ── Dates (IST) ─────────────────────────────────────────────
  function istKey(d) {
    d = d || new Date();
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(d);
    } catch (_) { return d.toISOString().slice(0, 10); }
  }
  function todayKey() { return istKey(new Date()); }

  function parseDateKey(v) {
    if (!v) return '';
    if (v instanceof Date && !isNaN(v)) return istKey(v);
    var s = String(v).trim();
    if (!s) return '';
    // gviz sometimes returns Date(y,m,d) literals.
    var g = s.match(/^Date\((\d+),(\d+),(\d+)/);
    if (g) {
      return g[1] + '-' + ('0' + (parseInt(g[2], 10) + 1)).slice(-2) + '-' + ('0' + g[3]).slice(-2);
    }
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[1] + '-' + m[2] + '-' + m[3];
    m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (m) {
      var dd = ('0' + m[1]).slice(-2), mm = ('0' + m[2]).slice(-2);
      var yy = m[3].length === 2 ? '20' + m[3] : m[3];
      return yy + '-' + mm + '-' + dd;
    }
    var d = new Date(s);
    return isNaN(d) ? '' : istKey(d);
  }

  function dayDiff(aKey, bKey) {
    if (!aKey || !bKey) return null;
    var a = new Date(aKey + 'T00:00:00Z'), b = new Date(bKey + 'T00:00:00Z');
    return Math.round((a - b) / 86400000);
  }
  // Shift a YYYY-MM-DD key by n days.
  function addDays(key, n) {
    var d = new Date((key || todayKey()) + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }

  // Overdue bucket relative to a reference date (default today).
  function followUpBucket(followUpDate, refKey) {
    var key = parseDateKey(followUpDate);
    if (!key) return 'none';
    var diff = dayDiff(refKey || todayKey(), key); // ref - due; +ve = overdue
    if (diff === 0) return 'due_today';
    if (diff < 0) return 'upcoming';
    if (diff <= 3) return 'overdue_1_3';
    if (diff <= 7) return 'overdue_3_7';
    return 'overdue_7_plus';
  }
  function overdueTone(days) { return days >= 7 ? 'crit' : (days >= 3 ? 'red' : 'amber'); }
  function overdueDot(days) { return days >= 7 ? '🔴' : (days >= 3 ? '🟠' : '🟡'); }
  function isOverdue(b) { return b === 'overdue_1_3' || b === 'overdue_3_7' || b === 'overdue_7_plus'; }

  // ── Formatting ──────────────────────────────────────────────
  function fmtDate(v) {
    var key = parseDateKey(v);
    if (!key) return '—';
    var d = new Date(key + 'T00:00:00Z');
    try {
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric',
      }).format(d);
    } catch (_) { return key; }
  }
  function fmtDayShort(key) {
    key = parseDateKey(key) || todayKey();
    var d = new Date(key + 'T00:00:00Z');
    try {
      return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' }).format(d);
    } catch (_) { return key; }
  }
  // "TODAY · 15 Sep" / "YESTERDAY · 14 Sep" / "TOMORROW · 16 Sep" / "12 Sep 2026"
  function dateNavLabel(key) {
    var t = todayKey();
    if (key === t) return 'TODAY · ' + fmtDayShort(key);
    if (key === addDays(t, -1)) return 'YESTERDAY · ' + fmtDayShort(key);
    if (key === addDays(t, 1)) return 'TOMORROW · ' + fmtDayShort(key);
    return fmtDate(key);
  }
  function fmtDateTime(v) {
    if (!v) return '—';
    var d = new Date(v);
    if (isNaN(d)) return String(v);
    try {
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: TZ, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
      }).format(d);
    } catch (_) { return d.toLocaleString(); }
  }
  // Short IST clock time for the "Updated" freshness indicator, e.g. "2:30 pm".
  function fmtTimeShort(v) {
    var d = v ? new Date(v) : new Date();
    if (isNaN(d)) return '';
    try {
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: true,
      }).format(d);
    } catch (_) { return d.toLocaleTimeString(); }
  }
  // Activity-feed relative time: today → "2:30 pm", yesterday → "Yesterday", else "12 Sep".
  function relTime(v) {
    if (!v) return '';
    var d = new Date(v);
    if (isNaN(d)) return String(v);
    var k = istKey(d), t = todayKey();
    if (k === t) {
      try { return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: true }).format(d); }
      catch (_) { return d.toLocaleTimeString(); }
    }
    if (k === addDays(t, -1)) return 'Yesterday';
    return fmtDayShort(k);
  }

  // ── Phone ───────────────────────────────────────────────────
  function normPhone(p) {
    var d = String(p || '').replace(/[^\d]/g, '');
    if (d.length === 10) d = '91' + d;
    if (d.length === 11 && d[0] === '0') d = '91' + d.slice(1);
    return d;
  }
  function fmtPhone(p) {
    var d = normPhone(p);
    if (!d) return '—';
    if (d.length === 12 && d.slice(0, 2) === '91') return '+91 ' + d.slice(2, 7) + ' ' + d.slice(7);
    return '+' + d;
  }

  // ── Activity log (local, HRS-scoped) ────────────────────────
  var LOG_KEY = 'hrs_activity_log';
  function logActivity(entry) {
    try {
      var list = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
      list.unshift(Object.assign({ ts: new Date().toISOString() }, entry));
      localStorage.setItem(LOG_KEY, JSON.stringify(list.slice(0, 30)));
    } catch (_) {}
  }
  function getLocalActivity() {
    try { return JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); } catch (_) { return []; }
  }

  global.HRSUtil = {
    esc: esc,
    normStatus: normStatus, isDone: isDone, statusLabel: statusLabel, statusBadge: statusBadge, STATUS_LABELS: STATUS_LABELS,
    istKey: istKey, todayKey: todayKey, parseDateKey: parseDateKey, dayDiff: dayDiff, addDays: addDays,
    followUpBucket: followUpBucket, isOverdue: isOverdue, overdueTone: overdueTone, overdueDot: overdueDot,
    fmtDate: fmtDate, fmtDayShort: fmtDayShort, dateNavLabel: dateNavLabel, fmtDateTime: fmtDateTime, fmtTimeShort: fmtTimeShort, relTime: relTime,
    normPhone: normPhone, fmtPhone: fmtPhone,
    logActivity: logActivity, getLocalActivity: getLocalActivity,
  };
})(window);
