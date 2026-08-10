import { workflow, node, trigger, ifElse, expr, newCredential } from '@n8n/workflow-sdk';

const PARSE_JS = `const raw = $input.first().json;
const body = raw.body ?? raw;

if (body.test === true) {
  return [{ json: { mode: 'test', ok: true, message: 'WhatsApp webhook connection verified.' } }];
}

const dryRun = body.dryRun === true;
const clients = Array.isArray(body.clients) ? body.clients : [];
const items = [];

for (const client of clients) {
  const reminders = (client.reminders || [])
    .map((r) => ({
      type: r?.type || 'custom',
      label: r?.label,
      filingDueDate: r?.filingDueDate || r?.dueDate,
      documentsDueBy: r?.documentsDueBy || r?.reminderDate,
    }))
    .filter((r) => r.label && r.filingDueDate && r.documentsDueBy);

  const phone = String(client.phone || '').trim();
  if (!phone || !reminders.length) continue;

  items.push({
    json: {
      client_name: client.name,
      client_phone: phone,
      client_email: client.email || '',
      reminders,
      reminder_count: reminders.length,
      dry_run: dryRun,
      triggered_by: body.triggeredBy || null,
    },
  });
}

if (!items.length) {
  return [{ json: { mode: 'empty', message: 'No reminders in payload.', dry_run: dryRun } }];
}

return items;`;

const BUILD_JS = `const docChecklists = {
  gst: ['Sales and purchase invoices', 'Credit/debit notes', 'Bank statements for GST payments'],
  itr: ['Form 16 / Form 16A', 'Bank statements (all accounts)', 'Investment proofs (80C, 80D, etc.)', 'Previous year ITR copy'],
  tds: ['Purchase/expense invoices (with TDS deducted)', 'Salary details and Form 16 data', 'Challan payment receipts'],
  advance_tax: ['Estimated income for the year', 'Previous advance tax challans', 'TDS certificates received'],
  roc: ['Audited financial statements', 'Board resolution / AGM details', 'Director KYC if applicable'],
};

function fmtDate(iso) {
  if (!iso) return iso;
  const p = iso.split('-');
  if (p.length !== 3) return iso;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return p[2] + ' ' + months[Number(p[1]) - 1] + ' ' + p[0];
}

function toWhatsAppAddr(phone) {
  const p = String(phone || '').trim();
  if (!p) return '';
  if (p.startsWith('whatsapp:')) return p;
  const digits = p.replace(/[^\\d+]/g, '');
  const e164 = digits.startsWith('+') ? digits : (digits.length === 10 ? '+91' + digits : '+' + digits);
  return 'whatsapp:' + e164;
}

const results = [];
for (const item of $input.all()) {
  const d = item.json;
  if (!d.client_phone || d.mode) continue;

  const sections = (d.reminders || []).map((rem, idx) => {
    const typeKey = (rem.type || rem.label || '').toLowerCase();
    const checklist = docChecklists[typeKey] || ['Please share all documents relevant to this item.'];
    const docs = checklist.slice(0, 3).join('; ');
    const filingDue = rem.filingDueDate || rem.dueDate;
    const documentsDue = rem.documentsDueBy || rem.reminderDate;
    return [
      '*' + (rem.label || 'Compliance item') + '*',
      'Filing due: ' + fmtDate(filingDue),
      'Send documents by: ' + fmtDate(documentsDue),
      'Please share: ' + docs,
    ].join('\\n');
  });

  const body = [
    'Hi ' + (d.client_name || 'there') + ',',
    '',
    'Reminder from your CA practice regarding upcoming compliance:',
    '',
    sections.join('\\n\\n'),
    '',
    'Reply to this message if you need clarification.',
    '',
    '— Sent via PowerhouseTech',
  ].join('\\n');

  results.push({
    json: {
      ...d,
      whatsapp_body: body,
      to_whatsapp: toWhatsAppAddr(d.client_phone),
    },
  });
}

return results.length ? results : [{ json: { mode: 'empty', message: 'No WhatsApp reminders after filtering.' } }];`;

const webhookTrigger = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Website WhatsApp Button',
    parameters: {
      httpMethod: 'POST',
      path: 'ca-filing-reminder-whatsapp',
      options: { allowedOrigins: '*' },
    },
  },
  output: [{ body: { test: true, clients: [] } }],
});

const parsePayload = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Parse Dashboard Payload',
    parameters: { jsCode: PARSE_JS },
  },
  output: [{
    client_name: 'Acme Traders',
    client_phone: '+919876543210',
    client_email: 'client@example.com',
    reminders: [{ type: 'gst', label: 'GST filing', filingDueDate: '2026-07-20', documentsDueBy: '2026-07-10' }],
    reminder_count: 1,
    dry_run: false,
  }],
});

const buildWhatsapp = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build Reminder WhatsApp',
    parameters: { jsCode: BUILD_JS },
  },
  output: [{
    client_name: 'Acme Traders',
    to_whatsapp: 'whatsapp:+919876543210',
    whatsapp_body: 'Hi Acme Traders,\n\nReminder from your CA practice...',
    dry_run: false,
  }],
});

const sendWhatsappIf = ifElse({
  version: 2.3,
  config: {
    name: 'Send WhatsApp?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [{
          leftValue: expr('{{ $json.dry_run }}'),
          rightValue: true,
          operator: { type: 'boolean', operation: 'notEquals' },
        }],
        combinator: 'and',
      },
    },
  },
});

const sendWhatsapp = node({
  type: 'n8n-nodes-base.twilio',
  version: 1,
  config: {
    name: 'Send WhatsApp (Twilio)',
    parameters: {
      resource: 'sms',
      operation: 'send',
      from: 'whatsapp:+14155238886',
      to: expr('{{ $json.to_whatsapp }}'),
      message: expr('{{ $json.whatsapp_body }}'),
    },
    credentials: { twilioApi: newCredential('Twilio WhatsApp') },
    onError: 'continueRegularOutput',
  },
  output: [{ sid: 'SMxxxxxxxx', status: 'queued' }],
});

export default workflow('ca-filing-reminder-whatsapp', 'CA Filing Reminder — WhatsApp (PowerhouseTech)')
  .add(webhookTrigger)
  .to(parsePayload)
  .to(buildWhatsapp)
  .to(sendWhatsappIf.onTrue(sendWhatsapp));
