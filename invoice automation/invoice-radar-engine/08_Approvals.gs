/**
 * Invoice Radar — approvals + reconciliation + rollover.
 * -----------------------------------------------------------------------------
 * The human-in-the-loop gate. R1 auto-sends; R2/Final wait here. The operator
 * approves/edits/snoozes/skips. Nothing firm goes out until Approval === Approved,
 * at which point the next runEngine_ tick sends it.
 */

/** Invoices currently awaiting a human decision. */
function pendingApprovals_() {
  var today = today_();
  return readTable_('Receivables').rows.filter(function (inv) {
    return decideReminder_(inv, today).action === 'need_approval';
  });
}

function findAR_(id) {
  var t = readTable_('Receivables');
  return t.rows.filter(function (r) { return String(r.InvoiceID) === String(id); })[0] || null;
}

/** Approve one. Optionally override the edited draft + channel. Sends on next tick. */
function approveOne_(id, editedDraft, channel) {
  var inv = findAR_(id); if (!inv) return { ok: false, error: 'not found' };
  writeRow_('Receivables', inv._r, {
    Approval: APPROVAL.APPROVED,
    Channel: channel || inv.Channel || CONST.DEFAULT_CHANNEL,
    Draft: editedDraft || inv.Draft
  });
  log_(id, 'approved', channel || inv.Channel, '');
  return { ok: true };
}

/** Approve every pending reminder as-is. */
function approveAll_() {
  var n = 0;
  pendingApprovals_().forEach(function (inv) {
    writeRow_('Receivables', inv._r, { Approval: APPROVAL.APPROVED });
    log_(inv.InvoiceID, 'approved_bulk', inv.Channel, ''); n++;
  });
  return n;
}

function snooze_(id, days) {
  var inv = findAR_(id); if (!inv) return { ok: false, error: 'not found' };
  writeRow_('Receivables', inv._r, {
    Approval: APPROVAL.NONE, Draft: '', SendAt: '',
    SnoozeUntil: ymd_(addDays_(today_(), days || CONST.SNOOZE_DAYS)),
    Status: STATUS.PROMISED
  });
  log_(id, 'snoozed', '', String(days || CONST.SNOOZE_DAYS) + 'd');
  return { ok: true };
}

function skip_(id) {
  var inv = findAR_(id); if (!inv) return { ok: false, error: 'not found' };
  writeRow_('Receivables', inv._r, { Approval: APPROVAL.SKIPPED, Draft: '', SendAt: '' });
  log_(id, 'skipped', '', '');
  return { ok: true };
}

function setChannel_(id, channel) {
  var inv = findAR_(id); if (!inv) return { ok: false, error: 'not found' };
  writeRow_('Receivables', inv._r, {
    Channel: channel,
    Draft: draftFor_(inv, stageOf_(inv, today_()), channel, today_())
  });
  return { ok: true };
}

/* ---- Reconciliation: the payment link that self-stops the chase ---------- */

/** Mark an invoice paid (from pay link or manual). Engine then skips it. */
function markPaid_(id, viaLink) {
  var inv = findAR_(id); if (!inv) return { ok: false, error: 'not found' };
  writeRow_('Receivables', inv._r, {
    Status: STATUS.PAID, Approval: APPROVAL.NONE, Draft: '', SendAt: '',
    LastContact: ymd_(today_())
  });
  log_(id, 'marked_paid', viaLink ? 'pay_link' : 'manual', '');
  pushPaidToBooks_(inv);  // two-way sync back to Zoho/Tally if connected
  return { ok: true };
}

function markDisputed_(id, reason) {
  var inv = findAR_(id); if (!inv) return { ok: false, error: 'not found' };
  writeRow_('Receivables', inv._r, { Status: STATUS.DISPUTED, Notes: reason || 'Disputed' });
  log_(id, 'disputed', '', reason || '');
  return { ok: true };
}

/* ---- Rollover: keep Receivables under the cap ---------------------------- */

/**
 * When Receivables reaches the cap, archive the oldest PAID rows to the Archive
 * tab and remove them, freeing space while keeping a record. PURE decision in
 * `pickRolloverRows_` for testability.
 */
function pickRolloverRows_(rows, cap) {
  if (rows.length < cap) return [];
  var paid = rows.filter(function (r) { return String(r.Status) === STATUS.PAID; });
  // archive oldest-paid first, enough to drop ~10% below the cap
  paid.sort(function (a, b) { return asDate_(a.Issued || 0) - asDate_(b.Issued || 0); });
  var target = rows.length - Math.floor(cap * 0.9);
  return paid.slice(0, Math.max(0, target));
}

function checkRollover_() {
  var t = readTable_('Receivables');
  var toArchive = pickRolloverRows_(t.rows, CONST.INVOICE_CAP);
  if (!toArchive.length) return 0;
  toArchive.forEach(function (r) {
    appendRow_('Archive', {
      InvoiceID: r.InvoiceID, Customer: r.Customer, Amount: r.Amount,
      Issued: r.Issued, Due: r.Due, Status: r.Status, ArchivedAt: ymd_(today_())
    });
  });
  deleteRows_('Receivables', toArchive.map(function (r) { return r._r; }));
  log_('rollover', 'archived_paid', '', String(toArchive.length) + ' rows');
  return toArchive.length;
}

/** Placeholder two-way sync hook (implemented per client in 11_Integrations.gs). */
function pushPaidToBooks_(inv) {
  try { if (typeof syncPaidToZoho_ === 'function') syncPaidToZoho_(inv); } catch (e) { /* non-fatal */ }
}
