/**
 * Invoice Radar — end-to-end functional harness.
 * Loads every .gs into the fake GAS runtime and drives each flow with assertions.
 * Run:  node tests/run.js
 */
const fs = require('fs'), path = require('path');
const T = require('./gas-stubs');
global.__T = T;

// Load engine source (all .gs, in numeric order) and concatenate.
const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir).filter(f => /\.gs$/.test(f)).sort();
let src = files.map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n\n');

// ---- Test body (runs in the SAME scope as the engine via eval) -------------
const tests = `
(function () {
  const A = __T; let pass = 0, fail = 0; const fails = [];
  function ok(name, cond) { if (cond) { pass++; } else { fail++; fails.push(name); console.log('  \\u2717 ' + name); } }
  function head(t){ console.log('\\n' + t); }

  // Deterministic clock (matches the prototype's "today").
  _clockToday = '2026-07-10';
  _clockISO = '2026-07-10T10:00:00.000Z';

  // ---------- Flow A: Setup ----------
  head('A. Setup / schema');
  initialize();
  ['Receivables','Payables','Review','Captured','Log','Archive'].forEach(function(t){
    ok('tab exists: ' + t, !!A.SS.getSheetByName(t));
  });
  ok('Receivables header correct',
     A.SS.getSheetByName('Receivables').getRange(1,1,1,SCHEMA.Receivables.length).getValues()[0].join(',') === SCHEMA.Receivables.join(','));

  // Seed the prototype's AR + AP rows.
  var seedAR = [
    ['INV-1009','Vertex Fitness','+919800000210','a@vertexfit.in',3200,'2026-05-10','2026-05-24','email','Unpaid',0,0,'','wa','','','','', ''],
    ['INV-1024','Sunrise Dental','+919900000884','a@sunrisedental.in',2400,'2026-06-02','2026-06-16','photo','Unpaid',0,0,'','wa','','','','', ''],
    ['INV-1031','Bluepeak Realty','+919000000120','ap@bluepeak.in',5750,'2026-06-20','2026-07-05','email','Unpaid',0,0,'','wa','','','','', ''],
    ['INV-1040','Harbor Cafe','+919800000771','o@harborcafe.in',860,'2026-07-01','2026-07-15','manual','Unpaid',0,0,'','wa','','','','', ''],
    ['INV-1045','Nova Studios','+919700000330','h@novastudios.in',1150,'2026-07-05','2026-07-19','photo','Unpaid',0,0,'','wa','','','','', ''],
    ['INV-1050','Meadow Clinic','+919500000402','a@meadowclinic.in',1900,'2026-06-18','2026-07-02','email','Paid',0,0,'','wa','','','','', '']
  ];
  seedAR.forEach(function(r){ appendRow_('Receivables', r); });
  appendRow_('Payables', ['BILL-560','Prime Office',2200,'2026-07-05','photo','Unpaid','','']);

  // ---------- Flow J: message drafts ----------
  head('J. Message drafts');
  var inv9 = findAR_('INV-1009');
  var wa = waMsg_(inv9, 3, today_());
  ok('WA msg has id', wa.indexOf('INV-1009') >= 0);
  ok('WA msg has amount', wa.indexOf('3,200') >= 0);
  ok('WA msg has pay link', wa.indexOf('pay.phtech.in/inv-1009') >= 0);
  ok('Email msg has subject', emailSubject_(inv9,3).indexOf('Final') >= 0);

  // ---------- Flow E: stage computation ----------
  head('E. Stage machine');
  ok('INV-1009 => Final (3)', stageOf_(findAR_('INV-1009'), today_()) === 3);
  ok('INV-1024 => Final (3)', stageOf_(findAR_('INV-1024'), today_()) === 3);
  ok('INV-1031 => R1 (1)',   stageOf_(findAR_('INV-1031'), today_()) === 1);
  ok('INV-1040 => not-due (0)', stageOf_(findAR_('INV-1040'), today_()) === 0);
  ok('INV-1050 paid => -1',  stageOf_(findAR_('INV-1050'), today_()) === -1);

  // ---------- KPI parity with prototype ----------
  head('KPI parity');
  var ar = A.getSheetObjects('Receivables', SCHEMA.Receivables);
  var outstanding = ar.filter(x=>x.Status!=='Paid').reduce((s,x)=>s+Number(x.Amount),0);
  var overdue = ar.filter(x=>x.Status!=='Paid' && overdueDays_(x.Due, today_())>0);
  ok('AR outstanding = 13360', outstanding === 13360);
  ok('AR overdue amount = 11350', overdue.reduce((s,x)=>s+Number(x.Amount),0) === 11350);
  ok('AR overdue count = 3', overdue.length === 3);

  // ---------- Flow E2: runEngine_ (auto vs gated) ----------
  head('E2. runEngine_ — R1 auto, R2/Final gated');
  A.resetSent();
  var sum = runEngine_();
  ok('one auto-send (R1)', sum.auto === 1);
  ok('two queued for approval', sum.queued === 2);
  ok('WhatsApp actually sent once', A.SENT.wa.length === 1);
  ok('R1 target was INV-1031', A.SENT.wa[0].text.body.indexOf('INV-1031') >= 0);
  ok('INV-1009 now Pending', findAR_('INV-1009').Approval === 'Pending');
  ok('INV-1009 has a draft', String(findAR_('INV-1009').Draft).length > 10);
  ok('INV-1031 LastSentStage=1', Number(findAR_('INV-1031').LastSentStage) === 1);

  // idempotency: running again should NOT resend R1
  A.resetSent(); var sum2 = runEngine_();
  ok('no double-send of R1', A.SENT.wa.length === 0 && sum2.auto === 0);

  // ---------- Flow F: approvals ----------
  head('F. Approval gate');
  A.resetSent();
  approveOne_('INV-1009', 'Edited final notice for Vertex — pay pay.phtech.in/inv-1009', 'wa');
  ok('INV-1009 Approved', findAR_('INV-1009').Approval === 'Approved');
  var sum3 = runEngine_();
  ok('approved firm reminder sent', A.SENT.wa.length === 1);
  ok('sent the EDITED draft', A.SENT.wa[0].text.body.indexOf('Edited final notice') >= 0);
  ok('INV-1009 LastSentStage=3', Number(findAR_('INV-1009').LastSentStage) === 3);
  ok('INV-1024 still pending', findAR_('INV-1024').Approval === 'Pending');

  // approveAll clears the rest
  A.resetSent(); var cleared = approveAll_(); runEngine_();
  ok('approveAll approved 1 (INV-1024)', cleared === 1);
  ok('INV-1024 sent after approveAll', A.SENT.wa.length === 1);

  // ---------- Flow G: snooze ----------
  head('G. Snooze / promise-to-pay');
  // reset INV-1040 to be overdue+firm by moving today forward via a fresh invoice
  appendRow_('Receivables', ['INV-1099','Test Co','+919000000001','t@x.in',1000,'2026-06-01','2026-06-10','manual','Unpaid',0,0,'','wa','','','','','']);
  ok('INV-1099 is Final stage', stageOf_(findAR_('INV-1099'), today_()) === 3);
  snooze_('INV-1099', 5);
  ok('snooze set future date', overdueDays_(findAR_('INV-1099').SnoozeUntil, today_()) < 0);
  var d = decideReminder_(findAR_('INV-1099'), today_());
  ok('snoozed invoice is skipped', d.action === 'skip' && d.reason === 'snoozed');

  // ---------- Flow B/C/D: capture routing ----------
  head('B/C/D. Capture routing (Claude mocked)');
  // high-confidence receivable -> AR
  A.setClaude(JSON.stringify({doc_type:'receivable',party:'Zephyr Media',reference:'INV-2001',
    amount:4300,currency:'INR',issue_date:'2026-07-01',due_date:'2026-07-15',
    confidence:{party:0.98,reference:0.97,amount:0.99,due_date:0.95},notes:''}));
  var beforeAR = A.getSheetObjects('Receivables', SCHEMA.Receivables).length;
  var r1 = extractDocument_({text:'invoice text'}); ok('extract ok (high conf)', r1.ok);
  var rt1 = routeCapture_(r1.data, 'email');
  ok('routed to AR', rt1.route === 'ar');
  ok('AR grew by 1', A.getSheetObjects('Receivables', SCHEMA.Receivables).length === beforeAR + 1);
  ok('Captured logged', A.getSheetObjects('Captured', SCHEMA.Captured).some(x=>x.Ref==='INV-2001'));

  // low-confidence due date -> Review
  A.setClaude(JSON.stringify({doc_type:'receivable',party:'Lakeview Interiors',reference:'INV-2002',
    amount:2750,currency:'INR',issue_date:'2026-07-05',due_date:'2026-07-20',
    confidence:{party:0.9,reference:0.9,amount:0.95,due_date:0.42},notes:'smudged Net-15'}));
  var r2 = extractDocument_({text:'blurry'});
  var rt2 = routeCapture_(r2.data, 'photo');
  ok('routed to Review', rt2.route === 'review');
  ok('Review has INV-2002', A.getSheetObjects('Review', SCHEMA.Review).some(x=>x.TempID==='INV-2002'));

  // confirm review -> promote to AR
  var beforeAR2 = A.getSheetObjects('Receivables', SCHEMA.Receivables).length;
  var cr = confirmReview_('INV-2002', {due_date:'2026-07-20'});
  ok('confirmReview ok', cr.ok === true);
  ok('Review now empty of INV-2002', !A.getSheetObjects('Review', SCHEMA.Review).some(x=>x.TempID==='INV-2002'));
  ok('AR grew after confirm', A.getSheetObjects('Receivables', SCHEMA.Receivables).length === beforeAR2 + 1);

  // payable routing
  A.setClaude(JSON.stringify({doc_type:'payable',party:'Rao Contractors',reference:'BILL-777',
    amount:1500,currency:'INR',issue_date:'2026-07-02',due_date:'2026-07-18',
    confidence:{party:0.95,reference:0.95,amount:0.98,due_date:0.9},notes:''}));
  var r3 = extractDocument_({text:'vendor bill'}); var rt3 = routeCapture_(r3.data, 'email');
  ok('routed to AP', rt3.route === 'ap');
  ok('Payables has BILL-777', A.getSheetObjects('Payables', SCHEMA.Payables).some(x=>x.BillID==='BILL-777'));

  // malformed extraction handled
  A.setClaude('sorry I cannot help');
  var rbad = extractDocument_({text:'x'});
  ok('malformed extraction fails safely', rbad.ok === false);

  // ---------- Flow H: reconciliation via pay link ----------
  head('H. Reconciliation (pay link stops the chase)');
  A.resetSent();
  var pr = routePayRequest_({pay:'INV-2001'});
  ok('pay link marks paid', pr.status === 'paid');
  ok('INV-2001 Status=Paid', findAR_('INV-2001').Status === 'Paid');
  var d2 = decideReminder_(findAR_('INV-2001'), today_());
  ok('paid invoice skipped by engine', d2.action === 'skip' && d2.reason === 'paid');
  var pr2 = routePayRequest_({pay:'INV-2001'});
  ok('second hit => already paid', pr2.status === 'already');
  var pr3 = routePayRequest_({pay:'NOPE'});
  ok('unknown id => notfound', pr3.status === 'notfound');

  // ---------- Flow I: rollover ----------
  head('I. Rollover at cap');
  var synthetic = [];
  for (var i=0;i<12;i++) synthetic.push({InvoiceID:'X'+i, Status: i<8?'Paid':'Unpaid', Issued:'2025-01-'+String((i%28)+1).padStart(2,'0')});
  var picked = pickRolloverRows_(synthetic, 5);
  ok('rollover picks only paid rows', picked.every(r=>r.Status==='Paid'));
  ok('rollover picks oldest first', picked.length>0 && picked[0].InvoiceID==='X0');
  ok('rollover leaves ~90% of cap', synthetic.length - picked.length <= Math.floor(5*0.9)+picked.length);
  ok('no rollover below cap', pickRolloverRows_(synthetic.slice(0,3), 5).length === 0);

  // ---------- Flow K: channel behaviour, fallback, disputes ----------
  head('K. Channels / fallback / disputes');
  // WA fails -> falls back to email (invoice has both phone + email)
  appendRow_('Receivables', ['INV-3001','Fallback Co','+919000000009','fb@x.in',900,'2026-06-01','2026-06-05','manual','Unpaid',0,0,'','wa','','','','','']);
  A.resetSent(); A.setWAFail(true);
  var okSend = sendReminder_(findAR_('INV-3001'), 3, 'wa', 'msg');
  ok('WA-fail falls back to email', okSend === true && A.SENT.email.length === 1 && A.SENT.wa.length === 0);
  A.setWAFail(false);

  // email-only invoice (no phone) still sends via email on channel=email
  appendRow_('Receivables', ['INV-3002','NoPhone Co','','np@x.in',700,'2026-06-01','2026-06-05','manual','Unpaid',0,0,'','email','','','','','']);
  A.resetSent();
  var okEmail = sendReminder_(findAR_('INV-3002'), 3, 'email', 'hello');
  ok('email channel sends via email', okEmail === true && A.SENT.email.length === 1);

  // setChannel_ regenerates the draft as the email variant
  setChannel_('INV-3002', 'email');
  ok('setChannel rewrites draft (email style)', String(findAR_('INV-3002').Draft).indexOf('team,') >= 0);

  // markDisputed_ pauses chasing
  markDisputed_('INV-3001', 'billing query');
  var dd = decideReminder_(findAR_('INV-3001'), today_());
  ok('disputed invoice is paused', findAR_('INV-3001').Status === 'Disputed' && dd.action === 'skip' && dd.reason === 'disputed');

  // audit log actually accumulated events
  ok('audit Log has rows', A.getSheetObjects('Log', SCHEMA.Log).length > 5);

  // ---------- done ----------
  console.log('\\n' + (fail===0 ? '\\u2705 ALL GREEN' : '\\u274C ' + fail + ' FAILED: ' + fails.join('; ')));
  console.log('   ' + pass + ' passed, ' + fail + ' failed');
  if (fail) process.exitCode = 1;
})();
`;

try { eval(src + '\n' + tests); }
catch (e) { console.error('HARNESS THREW:', e.message, '\n', e.stack); process.exitCode = 1; }
