/**
 * Harshul dashboard — shared helpers (dates in IST, statuses, phones).
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
      'inprogress': 'in_progress', 'in_progress': 'in_progress',
      'progress': 'in_progress', 'ongoing': 'in_progress',
      'done': 'completed', 'complete': 'completed', 'closed': 'completed',
      'cancel': 'cancelled', 'canceled': 'cancelled',
      '': 'new',
    };
    return aliases[s] || s || 'new';
  }
  var STATUS_LABELS = {
    new: 'New', in_progress: 'In Progress', completed: 'Completed', cancelled: 'Cancelled',
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
  // Returns YYYY-MM-DD for a date, evaluated in Asia/Kolkata.
  function istKey(d) {
    d = d || new Date();
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(d);
    } catch (_) {
      return d.toISOString().slice(0, 10);
    }
  }
  function todayKey() { return istKey(new Date()); }

  // Parse ISO / DD-MM-YYYY / DD/MM/YYYY / YYYY-MM-DD → YYYY-MM-DD key (or '').
  function parseDateKey(v) {
    if (!v) return '';
    if (v instanceof Date && !isNaN(v)) return istKey(v);
    var s = String(v).trim();
    if (!s) return '';
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); // ISO / yyyy-mm-dd
    if (m) return m[1] + '-' + m[2] + '-' + m[3];
    m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/); // dd-mm-yyyy / dd/mm/yyyy
    if (m) {
      var dd = ('0' + m[1]).slice(-2), mm = ('0' + m[2]).slice(-2);
      var yy = m[3].length === 2 ? '20' + m[3] : m[3];
      return yy + '-' + mm + '-' + dd;
    }
    var d = new Date(s);
    return isNaN(d) ? '' : istKey(d);
  }

  // Whole days between two YYYY-MM-DD keys (a - b). +ve → a after b.
  function dayDiff(aKey, bKey) {
    if (!aKey || !bKey) return null;
    var a = new Date(aKey + 'T00:00:00Z'), b = new Date(bKey + 'T00:00:00Z');
    return Math.round((a - b) / 86400000);
  }

  // Overdue bucket for a follow-up date (relative to today, IST).
  //  due_today | overdue_1_3 | overdue_3_7 | overdue_7_plus | upcoming | none
  function followUpBucket(followUpDate) {
    var key = parseDateKey(followUpDate);
    if (!key) return 'none';
    var diff = dayDiff(todayKey(), key); // today - due; +ve = overdue
    if (diff === 0) return 'due_today';
    if (diff < 0) return 'upcoming';
    if (diff <= 3) return 'overdue_1_3';
    if (diff <= 7) return 'overdue_3_7';
    return 'overdue_7_plus';
  }
  var BUCKET_LABELS = {
    due_today: 'Due Today', overdue_1_3: 'Overdue 1–3 days',
    overdue_3_7: 'Overdue 3–7 days', overdue_7_plus: 'Critical · 7+ days',
    upcoming: 'Upcoming', none: '—',
  };
  function isOverdue(b) { return b === 'overdue_1_3' || b === 'overdue_3_7' || b === 'overdue_7_plus'; }

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
  function fmtDateTime(v) {
    if (!v) return '—';
    var d = new Date(v);
    if (isNaN(d)) return String(v);
    try {
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: TZ, day: '2-digit', month: 'short', hour: '2-digit',
        minute: '2-digit', hour12: true,
      }).format(d);
    } catch (_) { return d.toLocaleString(); }
  }

  // ── Phone ───────────────────────────────────────────────────
  // Normalize to digits with country code (assume +91 if 10 digits).
  function normPhone(p) {
    var d = String(p || '').replace(/[^\d]/g, '');
    if (d.length === 10) d = '91' + d;
    if (d.length === 11 && d[0] === '0') d = '91' + d.slice(1);
    return d;
  }
  function fmtPhone(p) {
    var d = normPhone(p);
    if (!d) return '—';
    if (d.length === 12 && d.slice(0, 2) === '91') {
      return '+91 ' + d.slice(2, 7) + ' ' + d.slice(7);
    }
    return '+' + d;
  }

  // ── Activity log (local, HRS-scoped) ────────────────────────
  var LOG_KEY = 'hrs_activity_log';
  function logActivity(entry) {
    try {
      var list = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
      list.unshift(Object.assign({ ts: new Date().toISOString() }, entry));
      list = list.slice(0, 30);
      localStorage.setItem(LOG_KEY, JSON.stringify(list));
    } catch (_) {}
  }
  function getActivity() {
    try { return JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); } catch (_) { return []; }
  }

  global.HRSUtil = {
    esc: esc,
    normStatus: normStatus, statusLabel: statusLabel, statusBadge: statusBadge,
    STATUS_LABELS: STATUS_LABELS,
    istKey: istKey, todayKey: todayKey, parseDateKey: parseDateKey, dayDiff: dayDiff,
    followUpBucket: followUpBucket, BUCKET_LABELS: BUCKET_LABELS, isOverdue: isOverdue,
    fmtDate: fmtDate, fmtDateTime: fmtDateTime,
    normPhone: normPhone, fmtPhone: fmtPhone,
    logActivity: logActivity, getActivity: getActivity,
  };
})(window);
