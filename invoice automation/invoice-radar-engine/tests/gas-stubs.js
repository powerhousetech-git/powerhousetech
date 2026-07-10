/**
 * Fake Google Apps Script runtime for testing Invoice Radar in Node.
 * Implements just enough of SpreadsheetApp / PropertiesService / UrlFetchApp /
 * MailApp / GmailApp / Utilities / HtmlService / ScriptApp to run the engine
 * against an in-memory spreadsheet, with mocked Claude + WhatsApp endpoints.
 */

// ---- In-memory spreadsheet -------------------------------------------------
class FakeRange {
  constructor(sheet, r, c, nr, nc) { this.s = sheet; this.r = r; this.c = c; this.nr = nr; this.nc = nc; }
  getValues() {
    const out = [];
    for (let i = 0; i < this.nr; i++) {
      const row = [];
      for (let j = 0; j < this.nc; j++) {
        const rr = this.s.data[this.r - 1 + i] || [];
        row.push(rr[this.c - 1 + j] === undefined ? '' : rr[this.c - 1 + j]);
      }
      out.push(row);
    }
    return out;
  }
  setValues(vals) {
    for (let i = 0; i < vals.length; i++) {
      const ri = this.r - 1 + i;
      this.s.data[ri] = this.s.data[ri] || [];
      for (let j = 0; j < vals[i].length; j++) this.s.data[ri][this.c - 1 + j] = vals[i][j];
    }
    return this;
  }
  setValue(v) { this.s.data[this.r - 1] = this.s.data[this.r - 1] || []; this.s.data[this.r - 1][this.c - 1] = v; return this; }
}
class FakeSheet {
  constructor(name) { this.name = name; this.data = []; }
  getName() { return this.name; }
  getLastRow() { let n = 0; this.data.forEach((row, i) => { if (row && row.some(c => c !== '' && c !== undefined && c !== null)) n = i + 1; }); return n; }
  getRange(r, c, nr = 1, nc = 1) { return new FakeRange(this, r, c, nr, nc); }
  appendRow(arr) { this.data[this.getLastRow()] = arr.slice(); return this; }
  deleteRow(r) { this.data.splice(r - 1, 1); return this; }
  setFrozenRows() { return this; }
}
class FakeSpreadsheet {
  constructor() { this.sheets = {}; }
  getSheetByName(n) { return this.sheets[n] || null; }
  insertSheet(n) { this.sheets[n] = new FakeSheet(n); return this.sheets[n]; }
}
const SS = new FakeSpreadsheet();

global.SpreadsheetApp = {
  getActive: () => SS,
  openById: () => SS,
  getUi: () => ({ createMenu: () => ({ addItem() { return this; }, addSeparator() { return this; }, addToUi() {} }), alert: () => {} })
};

// ---- Properties ------------------------------------------------------------
const PROPS = {
  ANTHROPIC_API_KEY: 'test-key', WHATSAPP_TOKEN: 'wa-token', WHATSAPP_PHONE_ID: '123'
};
global.PropertiesService = {
  getScriptProperties: () => ({
    getProperty: k => (k in PROPS ? PROPS[k] : null),
    setProperties: (m) => { Object.assign(PROPS, m); }
  })
};

// ---- Outbound side effects captured for assertions -------------------------
const SENT = { wa: [], email: [] };
let MOCK_CLAUDE = null; // set per-test to control extraction output
let WA_FAIL = false;    // when true, WhatsApp API returns an error (tests fallback)

global.UrlFetchApp = {
  fetch: (url, opts) => {
    if (url.indexOf('anthropic') >= 0) {
      const text = typeof MOCK_CLAUDE === 'function' ? MOCK_CLAUDE(opts) : MOCK_CLAUDE;
      return { getResponseCode: () => 200,
        getContentText: () => JSON.stringify({ content: [{ type: 'text', text }] }) };
    }
    if (url.indexOf('graph.facebook.com') >= 0) {
      if (WA_FAIL) return { getResponseCode: () => 500, getContentText: () => '{"error":"down"}' };
      const p = JSON.parse(opts.payload); SENT.wa.push(p);
      return { getResponseCode: () => 200, getContentText: () => '{"messages":[{"id":"x"}]}' };
    }
    return { getResponseCode: () => 404, getContentText: () => '' };
  }
};
global.MailApp = { sendEmail: (o) => { SENT.email.push(o); } };
global.GmailApp = {
  search: () => [], getUserLabelByName: () => null,
  createLabel: () => ({}), getMessages: () => []
};
global.DriveApp = { getFolderById: () => ({ getFiles: () => ({ hasNext: () => false }) }) };
global.Utilities = { base64Encode: (b) => Buffer.from(b || '').toString('base64') };
global.HtmlService = { createHtmlOutput: (h) => ({ setTitle: () => ({ html: h }) }) };
global.ScriptApp = { getProjectTriggers: () => [], newTrigger: () => ({ timeBased: () => ({ everyDays: () => ({ atHour: () => ({ create() {} }) }), everyHours: () => ({ create() {} }) }) }), deleteTrigger: () => {} };
global.Logger = { log: () => {} };

module.exports = {
  SS, SENT,
  setClaude: (v) => { MOCK_CLAUDE = v; },
  setWAFail: (b) => { WA_FAIL = b; },
  resetSent: () => { SENT.wa.length = 0; SENT.email.length = 0; },
  getSheetObjects: (name, headers) => {
    const sh = SS.getSheetByName(name); if (!sh) return [];
    const last = sh.getLastRow(); const out = [];
    for (let r = 2; r <= last; r++) {
      const vals = sh.getRange(r, 1, 1, headers.length).getValues()[0];
      const o = {}; headers.forEach((h, i) => o[h] = vals[i]); out.push(o);
    }
    return out;
  }
};
