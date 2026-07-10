/**
 * Invoice Radar — pure utilities (no Google services).
 * Date math is intentionally UTC-day based so it's deterministic and testable.
 */

var MS_DAY = 86400000;

/** Parse a value (Date | 'YYYY-MM-DD' | ISO) to a Date at UTC midnight. */
function asDate_(v) {
  if (v instanceof Date) return new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()));
  if (typeof v === 'number') { var d = new Date(v); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); }
  var s = String(v).slice(0, 10);
  var p = s.split('-');
  return new Date(Date.UTC(+p[0], (+p[1]) - 1, +p[2]));
}

/** Whole days from b to a (a - b). Positive => a is later. */
function daysBetween_(a, b) {
  return Math.round((asDate_(a) - asDate_(b)) / MS_DAY);
}

/** Days a *due date* is overdue relative to `today` (today - due). */
function overdueDays_(due, today) { return daysBetween_(today, due); }

/** Add n days to a date, return a Date at UTC midnight. */
function addDays_(v, n) { return new Date(asDate_(v).getTime() + n * MS_DAY); }

/** 'YYYY-MM-DD' */
function ymd_(v) { return asDate_(v).toISOString().slice(0, 10); }

/** '10 Jul' style short date. */
function shortDate_(v) {
  var d = asDate_(v);
  var m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return d.getUTCDate() + ' ' + m[d.getUTCMonth()];
}

/** ₹ formatting, Indian grouping. */
function inr_(n) {
  var s = Math.round(Number(n)).toString();
  var neg = s[0] === '-'; if (neg) s = s.slice(1);
  var last3 = s.slice(-3), rest = s.slice(0, -3);
  if (rest) last3 = ',' + last3;
  rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return (neg ? '-' : '') + '₹' + rest + last3;
}

function firstName_(party) { return String(party || '').split(' ')[0] || 'there'; }

/** Payment link for an invoice id. */
function payLink_(id) { return CONST.PAY_BASE + String(id).toLowerCase(); }

/** ISO timestamp for logging. Overridable clock via _clockISO for tests. */
var _clockISO = null;
function nowISO_() { return _clockISO || new Date().toISOString(); }

/** "Today" as a UTC-midnight Date. Overridable via _clockToday for tests. */
var _clockToday = null;
function today_() { return _clockToday ? asDate_(_clockToday) : asDate_(new Date()); }
