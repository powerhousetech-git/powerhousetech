/**
 * Invoice Radar — payment-link web app.
 * -----------------------------------------------------------------------------
 * Deployed as a Web App. The pay link on every reminder is:
 *     <web-app-url>?pay=<invoice-id>
 * In production this page would hand off to a PSP (Razorpay/Stripe) and the
 * PSP webhook would call markPaid_. For the prototype/self-serve tier, hitting
 * the link marks the invoice paid and shows a receipt — which stops the chase.
 *
 * routePayRequest_ is PURE (returns {status, id, title}) so it's testable
 * without HtmlService.
 */

function routePayRequest_(params) {
  var id = params && params.pay;
  if (!id) return { status: 'home', title: 'Invoice Radar' };
  var inv = findAR_(id);
  if (!inv) return { status: 'notfound', id: id, title: 'Invoice not found' };
  if (String(inv.Status) === STATUS.PAID)
    return { status: 'already', id: id, amount: inv.Amount, title: 'Already paid' };
  markPaid_(id, true);
  return { status: 'paid', id: id, amount: inv.Amount, party: inv.Customer, title: 'Payment recorded' };
}

function doGet(e) {
  var r = routePayRequest_(e && e.parameter ? e.parameter : {});
  var html = payPageHtml_(r);
  // eslint-disable-next-line no-undef
  return HtmlService.createHtmlOutput(html).setTitle('Invoice Radar');
}

function payPageHtml_(r) {
  var body;
  if (r.status === 'paid')
    body = '<h1>\u2713 Payment recorded</h1><p>Thanks, ' + esc_(r.party) +
      '. Invoice <b>' + esc_(r.id) + '</b> for ' + inr_(r.amount) +
      ' is now marked paid. You won\u2019t receive further reminders.</p>';
  else if (r.status === 'already')
    body = '<h1>Already settled</h1><p>Invoice <b>' + esc_(r.id) + '</b> is already marked paid. Nothing to do.</p>';
  else if (r.status === 'notfound')
    body = '<h1>Not found</h1><p>We couldn\u2019t find invoice ' + esc_(r.id) + '.</p>';
  else
    body = '<h1>Invoice Radar</h1><p>Open a payment link to settle an invoice.</p>';
  return '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>body{font-family:system-ui,sans-serif;max-width:520px;margin:12vh auto;padding:0 22px;color:#16161A}' +
    'h1{font-size:1.5rem}b{color:#424FD1}</style>' + body;
}

function esc_(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}
