/**
 * Invoice Radar — capture (the three doors).
 * -----------------------------------------------------------------------------
 * routeCapture_ is the shared, testable core: given parsed data, it writes to
 * Receivables / Payables / Review and to the Captured log. The three doors
 * (Gmail, photo/Drive, manual) all funnel through extractDocument_ -> routeCapture_.
 */

/** Persist a parsed capture to the right tab. PURE-ish (only uses Sheet layer). */
function routeCapture_(data, source) {
  var cls = classifyCapture_(data);
  var when = ymd_(today_());

  if (cls.route === 'review') {
    appendRow_('Review', {
      TempID: data.reference || ('TMP-' + Date.now()),
      Party: data.party || 'Unknown',
      DocType: data.doc_type,
      Source: source,
      Amount: data.amount,
      AmountConf: data.confidence.amount,
      Due: data.due_date || '',
      DueConf: data.confidence.due_date,
      RawRef: data.reference || '',
      Note: 'Low confidence: ' + cls.lowFields.join(', ') + (data.notes ? (' — ' + data.notes) : ''),
      CapturedAt: when
    });
    log_(data.reference || 'capture', 'captured_to_review', source, cls.lowFields.join(','));
    return { route: 'review', lowFields: cls.lowFields };
  }

  if (cls.route === 'ap') {
    appendRow_('Payables', {
      BillID: data.reference, Vendor: data.party, Amount: data.amount,
      Due: data.due_date, Source: source, Status: STATUS.UNPAID, LastContact: '', Notes: data.notes
    });
  } else {
    appendRow_('Receivables', {
      InvoiceID: data.reference, Customer: data.party, Phone: '', Email: '',
      Amount: data.amount, Issued: data.issue_date || '', Due: data.due_date,
      Source: source, Status: STATUS.UNPAID, Stage: 0, LastSentStage: 0,
      Approval: APPROVAL.NONE, Channel: CONST.DEFAULT_CHANNEL, Draft: '', SendAt: '',
      SnoozeUntil: '', PayLink: payLink_(data.reference), LastContact: '', Notes: data.notes
    });
  }
  appendRow_('Captured', {
    Ref: data.reference, Party: data.party, DocType: data.doc_type,
    Source: source, Amount: data.amount, CapturedAt: when
  });
  log_(data.reference, 'captured_to_' + cls.route, source, '');
  return { route: cls.route, lowFields: [] };
}

/** DOOR 1+2: scan Gmail for invoices, extract, route, mark done. */
function captureFromGmail_() {
  // eslint-disable-next-line no-undef
  var threads = GmailApp.search(CONST.GMAIL_QUERY, 0, 25);
  // eslint-disable-next-line no-undef
  var done = GmailApp.getUserLabelByName(CONST.GMAIL_DONE_LABEL) ||
             GmailApp.createLabel(CONST.GMAIL_DONE_LABEL);
  var n = 0;
  threads.forEach(function (th) {
    var msg = th.getMessages()[th.getMessageCount() - 1];
    var atts = msg.getAttachments();
    var res;
    if (atts.length) {
      var a = atts[0];
      res = extractDocument_({
        imageB64: Utilities.base64Encode(a.getBytes()),
        mime: a.getContentType(),
        hint: 'From email subject: ' + msg.getSubject()
      });
    } else {
      res = extractDocument_({ text: msg.getPlainBody().slice(0, 4000),
        hint: 'From email subject: ' + msg.getSubject() });
    }
    if (res.ok) { routeCapture_(res.data, 'email'); n++; }
    else { log_('gmail', 'extract_failed', 'email', res.error); }
    th.addLabel(done);
  });
  return n;
}

/** DOOR 2 (photos dropped into a Drive folder). folderId from Script Properties. */
function captureFromDrive_() {
  // eslint-disable-next-line no-undef
  var fid = PropertiesService.getScriptProperties().getProperty('DRIVE_INBOX_FOLDER_ID');
  if (!fid) return 0;
  // eslint-disable-next-line no-undef
  var folder = DriveApp.getFolderById(fid);
  var files = folder.getFiles(), doneFolder = getOrMakeChildFolder_(folder, 'radar-done'), n = 0;
  while (files.hasNext()) {
    var f = files.next();
    var res = extractDocument_({
      imageB64: Utilities.base64Encode(f.getBlob().getBytes()),
      mime: f.getBlob().getContentType(), hint: 'Photo of a paper invoice.'
    });
    if (res.ok) { routeCapture_(res.data, 'photo'); n++; }
    else { log_(f.getName(), 'extract_failed', 'photo', res.error); }
    f.moveTo(doneFolder);
  }
  return n;
}

function getOrMakeChildFolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

/** DOOR 3: manual add from a menu prompt (already-structured). */
function captureManual_(data, source) {
  // data already has fields + confidence (default high); route it.
  data.confidence = data.confidence || { amount: 1, due_date: data.due_date ? 1 : 0, party: 1, reference: 1 };
  return routeCapture_(data, source || 'manual');
}

/** Confirm a Review row (human fixed it) -> promote to AR/AP. */
function confirmReview_(tempId, fixed) {
  var t = readTable_('Review');
  var row = t.rows.filter(function (r) { return String(r.TempID) === String(tempId); })[0];
  if (!row) return { ok: false, error: 'not found' };
  var data = {
    doc_type: row.DocType, party: fixed.party || row.Party,
    reference: row.RawRef || row.TempID, amount: fixed.amount || row.Amount,
    currency: 'INR', issue_date: fixed.issue_date || '',
    due_date: fixed.due_date || row.Due,
    confidence: { party: 1, reference: 1, amount: 1, due_date: 1 }, notes: 'Confirmed from review'
  };
  routeCapture_(data, row.Source);
  deleteRows_('Review', [row._r]);
  return { ok: true };
}
