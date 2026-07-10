/**
 * Invoice Radar — document extraction (Claude vision + text).
 * -----------------------------------------------------------------------------
 * `buildExtractPrompt_`, `parseExtraction_`, `classifyCapture_` are PURE and
 * unit-tested. `extractDocument_` is the thin wrapper that calls the Anthropic
 * API via UrlFetchApp. Photos and PDFs go in as base64 images; plain text goes
 * in as text.
 */

var EXTRACT_INSTRUCTIONS =
  'You are an accounts assistant. Read this invoice/receipt and return ONLY a JSON object, no prose. ' +
  'Schema: {"doc_type":"receivable|payable","party":string,"reference":string,' +
  '"amount":number,"currency":string,"issue_date":"YYYY-MM-DD","due_date":"YYYY-MM-DD",' +
  '"confidence":{"party":0-1,"reference":0-1,"amount":0-1,"due_date":0-1},"notes":string}. ' +
  'doc_type is "receivable" if WE issued it to a customer, "payable" if a vendor billed US. ' +
  'If a field is missing, use null and set its confidence to 0. Infer due_date from terms ' +
  '(e.g. "Net 15") only if issue_date is known, and lower its confidence when inferred.';

function buildExtractPrompt_(hint) {
  return EXTRACT_INSTRUCTIONS + (hint ? ('\nContext hint: ' + hint) : '');
}

/** Build the Anthropic messages payload. `content` is an array of blocks. */
function buildClaudeBody_(contentBlocks) {
  return {
    model: CONST.CLAUDE_MODEL,
    max_tokens: 1024,
    messages: [{ role: 'user', content: contentBlocks }]
  };
}

/** Image block from base64 + mime. */
function imageBlock_(b64, mime) {
  return { type: 'image', source: { type: 'base64', media_type: mime || 'image/jpeg', data: b64 } };
}
function textBlock_(t) { return { type: 'text', text: t }; }

/**
 * Parse Claude's response text into structured data.
 * Tolerates code fences / stray prose by grabbing the first {...} block.
 * Returns { ok, data?, error? }.
 */
function parseExtraction_(responseText) {
  if (!responseText) return { ok: false, error: 'empty response' };
  var m = String(responseText).match(/\{[\s\S]*\}/);
  if (!m) return { ok: false, error: 'no JSON found' };
  var obj;
  try { obj = JSON.parse(m[0]); }
  catch (e) { return { ok: false, error: 'bad JSON: ' + e.message }; }

  // Normalise + validate required shape.
  var conf = obj.confidence || {};
  var data = {
    doc_type: (obj.doc_type === 'payable') ? 'payable' : 'receivable',
    party: obj.party || null,
    reference: obj.reference || null,
    amount: (obj.amount === 0 || obj.amount) ? Number(obj.amount) : null,
    currency: obj.currency || 'INR',
    issue_date: obj.issue_date || null,
    due_date: obj.due_date || null,
    confidence: {
      party: num01_(conf.party), reference: num01_(conf.reference),
      amount: num01_(conf.amount), due_date: num01_(conf.due_date)
    },
    notes: obj.notes || ''
  };
  if (data.amount === null || isNaN(data.amount))
    return { ok: false, error: 'no amount parsed', data: data };
  return { ok: true, data: data };
}

function num01_(v) { var n = Number(v); return (isNaN(n) ? 0 : Math.max(0, Math.min(1, n))); }

/**
 * Decide where a parsed capture goes. PURE.
 * Returns { route:'ar'|'ap'|'review', lowFields:[...] }.
 * Any critical field below CONF_MIN => review.
 */
function classifyCapture_(data) {
  var low = CONST.CRITICAL_FIELDS.filter(function (f) {
    return (data.confidence[f] || 0) < CONST.CONF_MIN;
  });
  if (!data.due_date) low.indexOf('due_date') < 0 && low.push('due_date');
  if (low.length) return { route: 'review', lowFields: low };
  return { route: data.doc_type === 'payable' ? 'ap' : 'ar', lowFields: [] };
}

/** LIVE: call Claude to extract from image bytes or text. */
function extractDocument_(input) {
  // input = { text?:string, imageB64?:string, mime?:string, hint?:string }
  var blocks = [ textBlock_(buildExtractPrompt_(input.hint)) ];
  if (input.imageB64) blocks.push(imageBlock_(input.imageB64, input.mime));
  if (input.text) blocks.push(textBlock_('Document:\n' + input.text));

  // eslint-disable-next-line no-undef
  var resp = UrlFetchApp.fetch(CONST.CLAUDE_URL, {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    headers: {
      'x-api-key': getSecret_('ANTHROPIC_API_KEY'),
      'anthropic-version': CONST.CLAUDE_VERSION
    },
    payload: JSON.stringify(buildClaudeBody_(blocks))
  });
  var code = resp.getResponseCode();
  if (code !== 200) return { ok: false, error: 'Claude HTTP ' + code + ': ' + resp.getContentText() };
  var body = JSON.parse(resp.getContentText());
  var text = (body.content && body.content[0] && body.content[0].text) || '';
  return parseExtraction_(text);
}
