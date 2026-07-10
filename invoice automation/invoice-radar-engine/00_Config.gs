/**
 * Invoice Radar — Config
 * -----------------------------------------------------------------------------
 * Static tuning + tab/column schema live here. Secrets (API keys, tokens) live
 * in Script Properties — NEVER hardcode them. Set them once via Setup.setSecrets
 * or the Apps Script UI (Project Settings → Script properties).
 *
 * This file defines constants only. It performs no Google-service calls at load,
 * so the pure logic can be unit-tested outside Apps Script.
 */

// ---- Tuning ----------------------------------------------------------------
var CONST = {
  // Reminder ladder thresholds, in days *overdue* (today - due date).
  // Mirrors the prototype: d<=0 not-due, d<=7 R1, d<=20 R2, else Final.
  STAGE: { R1_MAX: 7, R2_MAX: 20 },     // Final = > R2_MAX
  AUTO_STAGE: 1,                        // only stage 1 (friendly) auto-sends
  SEND_HOUR: 16,                        // reminders scheduled for 4:00 PM local
  DEFAULT_CHANNEL: 'wa',               // WhatsApp first; 'email' is the fallback
  SNOOZE_DAYS: 5,                       // default snooze length
  INVOICE_CAP: 2000,                    // rows in Receivables before rollover
  PAY_BASE: 'https://pay.phtech.in/',   // payment-link base; {id} appended
  // Confidence gate: a capture with any critical field below this goes to Review.
  CONF_MIN: 0.80,
  CRITICAL_FIELDS: ['amount', 'due_date'],
  // Claude
  CLAUDE_MODEL: 'claude-sonnet-5',
  CLAUDE_URL: 'https://api.anthropic.com/v1/messages',
  CLAUDE_VERSION: '2023-06-01',
  // Gmail capture
  GMAIL_QUERY: 'label:invoices-inbox newer_than:30d -label:radar-done',
  GMAIL_DONE_LABEL: 'radar-done'
};

// ---- Sheet schema ----------------------------------------------------------
// One master spreadsheet, one tab per concern. Column order = header order.
var SCHEMA = {
  Receivables: ['InvoiceID','Customer','Phone','Email','Amount','Issued','Due',
                'Source','Status','Stage','LastSentStage','Approval','Channel',
                'Draft','SendAt','SnoozeUntil','PayLink','LastContact','Notes'],
  Payables:    ['BillID','Vendor','Amount','Due','Source','Status','LastContact','Notes'],
  Review:      ['TempID','Party','DocType','Source','Amount','AmountConf','Due',
                'DueConf','RawRef','Note','CapturedAt'],
  Captured:    ['Ref','Party','DocType','Source','Amount','CapturedAt'],
  Log:         ['Timestamp','Ref','Event','Channel','Detail'],
  Archive:     ['InvoiceID','Customer','Amount','Issued','Due','Status','ArchivedAt']
};

// Status vocab
var STATUS = {
  UNPAID: 'Unpaid', PAID: 'Paid', DISPUTED: 'Disputed', PROMISED: 'Promised'
};
var APPROVAL = {
  NONE: '', PENDING: 'Pending', APPROVED: 'Approved',
  SNOOZED: 'Snoozed', SKIPPED: 'Skipped'
};

// ---- Secrets (lazy; read from Script Properties) ---------------------------
function getSecret_(key) {
  // eslint-disable-next-line no-undef
  var v = PropertiesService.getScriptProperties().getProperty(key);
  if (!v) throw new Error('Missing script property: ' + key +
    ' — set it in Project Settings → Script properties.');
  return v;
}
function getMasterId_() {
  // eslint-disable-next-line no-undef
  var p = PropertiesService.getScriptProperties().getProperty('MASTER_SHEET_ID');
  return p || null; // null => use the bound spreadsheet
}
