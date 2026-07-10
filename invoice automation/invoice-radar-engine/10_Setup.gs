/**
 * Invoice Radar — Setup, menu, triggers.
 * -----------------------------------------------------------------------------
 * Run initialize() once from the Apps Script editor (or the Radar menu) to build
 * every tab with the right headers. installTriggers() wires the daily engine run
 * and the inbox/photo scans.
 */

function initialize() {
  var ss = ss_();
  Object.keys(SCHEMA).forEach(function (name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    // (Re)write header row.
    sh.getRange(1, 1, 1, SCHEMA[name].length).setValues([SCHEMA[name]]);
    sh.setFrozenRows(1);
  });
  log_('setup', 'initialized', '', Object.keys(SCHEMA).join(','));
  return 'Initialized tabs: ' + Object.keys(SCHEMA).join(', ');
}

/** Store secrets safely (call once from the editor with your values, then delete). */
function setSecrets(map) {
  // eslint-disable-next-line no-undef
  PropertiesService.getScriptProperties().setProperties(map, false);
  return 'Secrets stored: ' + Object.keys(map).join(', ');
}

function installTriggers() {
  // eslint-disable-next-line no-undef
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  // eslint-disable-next-line no-undef
  ScriptApp.newTrigger('dailyRun').timeBased().everyDays(1).atHour(CONST.SEND_HOUR).create();
  // eslint-disable-next-line no-undef
  ScriptApp.newTrigger('scanInbox').timeBased().everyHours(2).create();
  return 'Triggers installed: dailyRun @' + CONST.SEND_HOUR + ':00, scanInbox every 2h';
}

/** The daily job: send due reminders, queue approvals, housekeeping. */
function dailyRun() {
  var s = runEngine_();
  log_('engine', 'daily_run', '', JSON.stringify(s));
  return s;
}

/** The capture job: pull from Gmail + Drive. */
function scanInbox() {
  var g = 0, d = 0;
  try { g = captureFromGmail_(); } catch (e) { log_('gmail', 'scan_error', '', e.message); }
  try { d = captureFromDrive_(); } catch (e) { log_('drive', 'scan_error', '', e.message); }
  return { email: g, photos: d };
}

/** Custom menu on the sheet. */
function onOpen() {
  // eslint-disable-next-line no-undef
  SpreadsheetApp.getUi()
    .createMenu('Invoice Radar')
    .addItem('Initialize tabs', 'initialize')
    .addItem('Scan inbox now', 'scanInbox')
    .addItem('Run chase engine now', 'dailyRun')
    .addSeparator()
    .addItem('Approve all pending', 'menuApproveAll')
    .addItem('Install triggers', 'installTriggers')
    .addToUi();
}

function menuApproveAll() {
  var n = approveAll_();
  // eslint-disable-next-line no-undef
  SpreadsheetApp.getUi().alert(n + ' reminder(s) approved. They send on the next engine run.');
}
