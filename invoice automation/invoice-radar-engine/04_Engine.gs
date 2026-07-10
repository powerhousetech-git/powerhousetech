/**
 * Invoice Radar — the chase engine (conveyor-belt state machine).
 * -----------------------------------------------------------------------------
 * `stageOf_` and `decideReminder_` are PURE (no Google services) so the whole
 * decision layer is unit-tested. `runEngine_` is the thin driver that reads the
 * sheet, asks `decideReminder_` what to do per invoice, and performs side effects
 * (send / write back / log).
 *
 * Ladder (days overdue = today - due):
 *   <= 0            Stage 0  Not started
 *   1 .. R1_MAX     Stage 1  Reminder 1 · friendly   -> AUTO-SENDS
 *   R1_MAX+1..R2_MAX Stage 2 Reminder 2 · firm       -> APPROVAL-GATED
 *   > R2_MAX        Stage 3  Final notice            -> APPROVAL-GATED
 */

function stageOf_(inv, today) {
  if (String(inv.Status) === STATUS.PAID) return -1;
  var d = overdueDays_(inv.Due, today);
  if (d <= 0) return 0;
  if (d <= CONST.STAGE.R1_MAX) return 1;
  if (d <= CONST.STAGE.R2_MAX) return 2;
  return 3;
}

function needsApproval_(stage) { return stage >= 2; }

/**
 * Decide what should happen to ONE invoice this run. Pure: returns an intent,
 * never touches the sheet. The driver interprets the intent.
 *
 * Returns { action, stage, channel, draft?, reason }
 *   action: 'none' | 'auto_send' | 'need_approval' | 'send_approved' | 'skip'
 */
function decideReminder_(inv, today) {
  var status = String(inv.Status || STATUS.UNPAID);
  if (status === STATUS.PAID)     return { action: 'skip', reason: 'paid' };
  if (status === STATUS.DISPUTED) return { action: 'skip', reason: 'disputed' };

  var approval = String(inv.Approval || '');
  if (approval === APPROVAL.SKIPPED) return { action: 'skip', reason: 'skipped' };

  // Snooze / promise-to-pay: hold until SnoozeUntil passes.
  if (inv.SnoozeUntil && overdueDays_(inv.SnoozeUntil, today) < 0)
    return { action: 'skip', reason: 'snoozed' };

  var stage = stageOf_(inv, today);
  var lastSent = Number(inv.LastSentStage || 0);
  var channel = inv.Channel || CONST.DEFAULT_CHANNEL;

  if (stage <= 0)          return { action: 'none', stage: stage, reason: 'not_due' };
  if (stage <= lastSent)   return { action: 'none', stage: stage, reason: 'stage_already_sent' };

  // A new, higher stage is due.
  var draft = inv.Draft || draftFor_(inv, stage, channel, today);

  if (!needsApproval_(stage)) {                 // Stage 1: auto
    return { action: 'auto_send', stage: stage, channel: channel, draft: draft, reason: 'auto_r1' };
  }
  // Stage 2/3: gated
  if (approval === APPROVAL.APPROVED) {
    return { action: 'send_approved', stage: stage, channel: channel,
             draft: inv.Draft || draft, reason: 'approved' };
  }
  return { action: 'need_approval', stage: stage, channel: channel, draft: draft, reason: 'gate' };
}

/** Driver: iterate Receivables, act on each intent. Returns a summary. */
function runEngine_() {
  var today = today_();
  var t = readTable_('Receivables');
  var summary = { auto: 0, queued: 0, sent: 0, skipped: 0, none: 0 };

  t.rows.forEach(function (inv) {
    var intent = decideReminder_(inv, today);
    switch (intent.action) {
      case 'auto_send':
      case 'send_approved': {
        var ok = sendReminder_(inv, intent.stage, intent.channel, intent.draft);
        if (ok) {
          writeRow_('Receivables', inv._r, {
            LastSentStage: intent.stage,
            LastContact: ymd_(today),
            Approval: APPROVAL.NONE,
            Draft: '',
            SendAt: ''
          });
          summary[intent.action === 'auto_send' ? 'auto' : 'sent']++;
          log_(inv.InvoiceID, 'reminder_sent_stage_' + intent.stage, intent.channel, intent.reason);
        }
        break;
      }
      case 'need_approval': {
        // Only (re)write the pending draft if it isn't already pending for this stage.
        if (String(inv.Approval) !== APPROVAL.PENDING || !inv.Draft) {
          writeRow_('Receivables', inv._r, {
            Approval: APPROVAL.PENDING,
            Channel: intent.channel,
            Draft: intent.draft,
            Stage: intent.stage,
            SendAt: ymd_(today) + ' ' + CONST.SEND_HOUR + ':00'
          });
          log_(inv.InvoiceID, 'reminder_needs_approval_stage_' + intent.stage, intent.channel, '');
        }
        summary.queued++;
        break;
      }
      case 'skip': summary.skipped++; break;
      default:     summary.none++;
    }
    // Keep the displayed Stage column fresh regardless.
    if (intent.stage !== undefined && Number(inv.Stage) !== intent.stage)
      writeCell_('Receivables', inv._r, 'Stage', intent.stage);
  });

  // Housekeeping after a run.
  checkRollover_();
  return summary;
}
