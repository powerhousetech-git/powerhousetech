/**
 * Invoice Radar — Sheet access layer
 * -----------------------------------------------------------------------------
 * ALL spreadsheet I/O goes through these helpers. Keeping the surface small means
 * the rest of the engine is easy to reason about and easy to test (the Node
 * harness only has to fake this handful of operations).
 *
 * A "table" read returns { headers, rows }, where each row is a plain object keyed
 * by header plus a hidden `_r` (1-based sheet row index) so we can write back.
 */

function ss_() {
  var id = getMasterId_();
  // eslint-disable-next-line no-undef
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActive();
}

function sheet_(name) {
  var sh = ss_().getSheetByName(name);
  if (!sh) throw new Error('Missing tab: ' + name + ' — run Setup.initialize().');
  return sh;
}

/** Read a whole tab into objects. Empty tab => { headers, rows:[] }. */
function readTable_(name) {
  var sh = sheet_(name);
  var lastRow = sh.getLastRow();
  var headers = SCHEMA[name];
  if (lastRow < 2) return { headers: headers, rows: [] };
  var values = sh.getRange(2, 1, lastRow - 1, headers.length).getValues();
  var rows = values.map(function (v, i) {
    var o = { _r: i + 2 };
    headers.forEach(function (h, c) { o[h] = v[c]; });
    return o;
  });
  return { headers: headers, rows: rows };
}

/** Append one record (object keyed by header, or a positional array). */
function appendRow_(name, rec) {
  var sh = sheet_(name);
  var headers = SCHEMA[name];
  var arr = Array.isArray(rec) ? rec : headers.map(function (h) {
    return rec[h] === undefined ? '' : rec[h];
  });
  sh.appendRow(arr);
  return sh.getLastRow();
}

/** Update one cell by (tab, 1-based row, header name). */
function writeCell_(name, row, header, value) {
  var col = SCHEMA[name].indexOf(header) + 1;
  if (col < 1) throw new Error('No column "' + header + '" in ' + name);
  sheet_(name).getRange(row, col, 1, 1).setValue(value);
}

/** Update several cells on one row in a single write. patch = {Header: value}. */
function writeRow_(name, row, patch) {
  var headers = SCHEMA[name];
  var sh = sheet_(name);
  var current = sh.getRange(row, 1, 1, headers.length).getValues()[0];
  headers.forEach(function (h, c) {
    if (patch[h] !== undefined) current[c] = patch[h];
  });
  sh.getRange(row, 1, 1, headers.length).setValues([current]);
}

/** Delete a set of 1-based row indices from a tab (descending, so indices hold). */
function deleteRows_(name, rowIndices) {
  var sh = sheet_(name);
  rowIndices.slice().sort(function (a, b) { return b - a; })
    .forEach(function (r) { sh.deleteRow(r); });
}

/** Structured audit log. */
function log_(ref, event, channel, detail) {
  appendRow_('Log', {
    Timestamp: nowISO_(), Ref: ref, Event: event,
    Channel: channel || '', Detail: detail || ''
  });
}
