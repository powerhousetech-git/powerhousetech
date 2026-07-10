/**
 * Invoice Radar — portal API for the authenticated web dashboard.
 * Snapshot (read) + approval/capture writes. Auth via PORTAL_CLIENT_KEY script property.
 */

function getPortalKey_() {
  // eslint-disable-next-line no-undef
  return PropertiesService.getScriptProperties().getProperty('PORTAL_CLIENT_KEY') || '';
}

function portalCheckKey_(key) {
  var expected = getPortalKey_();
  return expected && String(key) === String(expected);
}

function portalJson_(obj, status) {
  // eslint-disable-next-line no-undef
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function portalUnauthorized_() {
  return portalJson_({ ok: false, error: 'unauthorized' });
}

function portalStageLabel_(stage) {
  if (stage <= 0) return 'Not started';
  if (stage === 1) return 'Reminder 1 · friendly';
  if (stage === 2) return 'Reminder 2 · firm';
  return 'Final notice';
}

function portalStagePill_(inv, today) {
  if (String(inv.Status) === STATUS.PAID) return 'paid';
  var stage = stageOf_(inv, today);
  var intent = decideReminder_(inv, today);
  if (intent.action === 'need_approval') return 'approval';
  if (stage === 1 && Number(inv.LastSentStage || 0) >= 1) return 'r1_sent';
  if (stage >= 1 && Number(inv.LastSentStage || 0) >= stage) return 'r1_sent';
  return 'pending';
}

function portalRisk_(stage) {
  if (stage <= 1) return 'soft';
  if (stage === 2) return 'firm';
  return 'final';
}

function mapReceivable_(inv, today) {
  var stage = stageOf_(inv, today);
  var intent = decideReminder_(inv, today);
  var od = overdueDays_(inv.Due, today);
  return {
    id: String(inv.InvoiceID),
    party: String(inv.Customer || ''),
    phone: String(inv.Phone || ''),
    email: String(inv.Email || ''),
    amount: Number(inv.Amount || 0),
    issued: ymd_(inv.Issued || today),
    due: ymd_(inv.Due || today),
    source: String(inv.Source || ''),
    status: String(inv.Status || STATUS.UNPAID),
    stage: stage,
    stageLabel: portalStageLabel_(stage),
    stagePill: portalStagePill_(inv, today),
    overdueDays: od,
    payLink: String(inv.PayLink || payLink_(inv.InvoiceID)),
    channel: String(inv.Channel || CONST.DEFAULT_CHANNEL),
    draft: String(inv.Draft || draftFor_(inv, Math.max(stage, 1), inv.Channel || CONST.DEFAULT_CHANNEL, today)),
    needsApproval: intent.action === 'need_approval',
    approval: String(inv.Approval || '')
  };
}

function mapPayable_(bill, today) {
  return {
    id: String(bill.BillID),
    party: String(bill.Vendor || ''),
    amount: Number(bill.Amount || 0),
    due: ymd_(bill.Due || today),
    source: String(bill.Source || ''),
    status: String(bill.Status || STATUS.UNPAID),
    overdueDays: overdueDays_(bill.Due, today)
  };
}

function mapApproval_(inv, today) {
  var stage = stageOf_(inv, today);
  var ch = inv.Channel || CONST.DEFAULT_CHANNEL;
  return {
    id: String(inv.InvoiceID),
    party: String(inv.Customer || ''),
    amount: Number(inv.Amount || 0),
    due: ymd_(inv.Due || today),
    overdueDays: overdueDays_(inv.Due, today),
    stage: stage,
    stageLabel: portalStageLabel_(stage),
    risk: portalRisk_(stage),
    channel: String(ch),
    draft: String(inv.Draft || draftFor_(inv, stage, ch, today))
  };
}

function mapReview_(row) {
  return {
    tempId: String(row.TempID),
    party: String(row.Party || ''),
    ref: String(row.RawRef || row.TempID),
    source: String(row.Source || ''),
    amount: Number(row.Amount || 0),
    due: String(row.Due || ''),
    amountConf: Number(row.AmountConf || 0) >= CONST.CONF_MIN ? 'high' : 'low',
    dueConf: Number(row.DueConf || 0) >= CONST.CONF_MIN ? 'high' : 'low',
    note: String(row.Note || '')
  };
}

function portalSnapshot_() {
  var today = today_();
  var ar = readTable_('Receivables').rows;
  var ap = readTable_('Payables').rows;
  var review = readTable_('Review').rows;
  var captured = readTable_('Captured').rows;
  var log = readTable_('Log').rows;

  var openAR = ar.filter(function (r) { return String(r.Status) !== STATUS.PAID; });
  var outstanding = openAR.reduce(function (s, r) { return s + Number(r.Amount || 0); }, 0);
  var overdueRows = openAR.filter(function (r) { return overdueDays_(r.Due, today) > 0; });
  var overdue = overdueRows.reduce(function (s, r) { return s + Number(r.Amount || 0); }, 0);
  var payable = ap.filter(function (r) { return String(r.Status) !== STATUS.PAID; })
    .reduce(function (s, r) { return s + Number(r.Amount || 0); }, 0);

  var approvals = pendingApprovals_().map(function (inv) { return mapApproval_(inv, today); });

  var activity = log.slice(-20).reverse().map(function (r) {
    return {
      ref: String(r.Ref || ''),
      event: String(r.Event || ''),
      channel: String(r.Channel || ''),
      detail: String(r.Detail || ''),
      timestamp: String(r.Timestamp || '')
    };
  });

  return {
    ok: true,
    kpis: {
      outstanding: outstanding,
      overdue: overdue,
      overdueCount: overdueRows.length,
      payable: payable,
      openInvoices: openAR.length,
      approvalCount: approvals.length,
      reviewCount: review.length
    },
    receivables: openAR.map(function (inv) { return mapReceivable_(inv, today); }),
    payables: ap.filter(function (r) { return String(r.Status) !== STATUS.PAID; })
      .map(function (b) { return mapPayable_(b, today); }),
    approvals: approvals,
    review: review.map(mapReview_),
    captured: captured.slice(-30).reverse().map(function (c) {
      return {
        ref: String(c.Ref || ''),
        party: String(c.Party || ''),
        type: String(c.DocType || ''),
        source: String(c.Source || ''),
        amount: Number(c.Amount || 0),
        capturedAt: String(c.CapturedAt || '')
      };
    }),
    activity: activity
  };
}

function portalHandlePost_(body) {
  if (!body || !portalCheckKey_(body.key)) return { ok: false, error: 'unauthorized' };

  var action = String(body.action || '');
  var id = body.id != null ? String(body.id) : '';

  switch (action) {
    case 'approve':
      return approveOne_(id, body.draft || body.editedDraft, body.channel);
    case 'approveAll':
      return { ok: true, count: approveAll_() };
    case 'snooze':
      return snooze_(id, body.days || CONST.SNOOZE_DAYS);
    case 'skip':
      return skip_(id);
    case 'setChannel':
      return setChannel_(id, body.channel);
    case 'markPaid':
      return markPaid_(id, false);
    case 'confirmReview':
      return confirmReview_(id, body.fixed || {});
    default:
      return { ok: false, error: 'unknown_action' };
  }
}
