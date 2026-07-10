/**
 * Invoice Radar — sending. WhatsApp Business API first, email fallback.
 * SMS is intentionally NOT auto-wired: India requires DLT registration, so it's
 * a manual/opt-in fallback configured per client.
 *
 * sendReminder_ returns true on success so the engine only advances the stage
 * when a message actually went out.
 */

function sendReminder_(inv, stage, channel, draft) {
  try {
    if (channel === 'email') return sendEmail_(inv, stage, draft);
    var ok = sendWhatsApp_(inv.Phone, draft);
    if (!ok && inv.Email) {           // graceful fallback WA -> email
      log_(inv.InvoiceID, 'wa_failed_fallback_email', 'wa', '');
      return sendEmail_(inv, stage, draft);
    }
    return ok;
  } catch (e) {
    log_(inv.InvoiceID, 'send_error', channel, e.message);
    return false;
  }
}

function sendWhatsApp_(phone, body) {
  if (!phone) return false;
  var token = getSecret_('WHATSAPP_TOKEN');
  var phoneId = getSecret_('WHATSAPP_PHONE_ID');
  var url = 'https://graph.facebook.com/v20.0/' + phoneId + '/messages';
  var payload = {
    messaging_product: 'whatsapp',
    to: normalizePhone_(phone),
    type: 'text',
    text: { body: body }
  };
  // eslint-disable-next-line no-undef
  var resp = UrlFetchApp.fetch(url, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify(payload)
  });
  return resp.getResponseCode() >= 200 && resp.getResponseCode() < 300;
}

function sendEmail_(inv, stage, body) {
  if (!inv.Email) return false;
  // eslint-disable-next-line no-undef
  MailApp.sendEmail({ to: inv.Email, subject: emailSubject_(inv, stage), body: body });
  return true;
}

/** Strip spaces / masking; ensure country code. Masked demo numbers won't send. */
function normalizePhone_(p) {
  var s = String(p).replace(/[^\d+]/g, '');
  if (s.indexOf('+') !== 0 && s.length === 10) s = '+91' + s;
  return s;
}
