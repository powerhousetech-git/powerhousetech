/**
 * Invoice Radar — reminder message drafts (pure functions).
 * WhatsApp-first, with an email variant. `step` is the stage (1=friendly,
 * 2=firm, 3=final). Every message carries the payment link so a customer can
 * settle in one tap — which is what auto-stops the chase.
 */

function waMsg_(inv, step, today) {
  var d = overdueDays_(inv.Due, today), f = firstName_(inv.Customer),
      a = inr_(inv.Amount), link = payLink_(inv.InvoiceID), id = inv.InvoiceID;
  if (step <= 1)
    return 'Hi ' + f + ' \uD83D\uDC4B Friendly reminder that invoice ' + id +
      ' for ' + a + ' was due ' + shortDate_(inv.Due) +
      ". If it's already sent, please ignore! Pay in a tap: " + link;
  if (step === 2)
    return 'Hi ' + f + ', invoice ' + id + ' (' + a + ') is now ' + d +
      ' days past due. Could you let us know when we can expect it? Pay here: ' + link;
  return 'Hi ' + f + ', final reminder \u2014 invoice ' + id + ' for ' + a +
    ' is ' + d + ' days overdue. Please settle today to avoid escalation. Pay: ' + link;
}

function emailMsg_(inv, step, today) {
  var d = overdueDays_(inv.Due, today), f = firstName_(inv.Customer),
      a = inr_(inv.Amount), id = inv.InvoiceID;
  if (step <= 1)
    return 'Hi ' + f + ' team,\n\nA friendly note that invoice ' + id + ' for ' + a +
      ' (due ' + shortDate_(inv.Due) + ') is showing unpaid. If it\u2019s on its way, please ignore.\n\nThanks,\nAccounts';
  if (step === 2)
    return 'Hi ' + f + ' team,\n\nFollowing up on invoice ' + id + ' for ' + a +
      ', now ' + d + ' days past its ' + shortDate_(inv.Due) +
      ' due date. Could you share an expected payment date?\n\nThanks,\nAccounts';
  return 'Hi ' + f + ' team,\n\nInvoice ' + id + ' for ' + a + ' is now ' + d +
    ' days overdue. This is a final reminder before we escalate. Please settle today or reply to arrange a plan.\n\nAccounts';
}

/** Channel-aware draft. channel: 'wa' | 'email'. */
function draftFor_(inv, step, channel, today) {
  return channel === 'email' ? emailMsg_(inv, step, today) : waMsg_(inv, step, today);
}

/** Subject line for email reminders. */
function emailSubject_(inv, step) {
  if (step <= 1) return 'Reminder: invoice ' + inv.InvoiceID + ' (' + inr_(inv.Amount) + ')';
  if (step === 2) return 'Following up: invoice ' + inv.InvoiceID + ' is past due';
  return 'Final notice: invoice ' + inv.InvoiceID;
}
