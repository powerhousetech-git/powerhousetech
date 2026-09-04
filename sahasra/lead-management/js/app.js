(function () {
  'use strict';

  /* ─ State ─────────────────────────────────────────────────────────────────── */
  var state = {
    user: null,
    view: 'dashboard',
    leads: [], leadsTotal: 0, leadsPage: 1,
    leadsSearch: '', leadsStatus: '', leadsSource: '',
    projects: [],
    mailConfig: [],
    selectedLead: null,
    selectedProject: null,
    reviewDrafts: [],
    captureTab: 'pdf',
    excel: { headers: [], rows: [], mapping: {}, filename: '' },
  };

  /* ─ DOM helpers ──────────────────────────────────────────────────────────── */
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function show(id) { ['gate-view','app-shell'].forEach(function(v){ var el = $(v); if(el) el.classList.toggle('hidden', v !== id); }); }
  function toast(msg, err) {
    var el = $('toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'toast show' + (err ? ' err' : '');
    setTimeout(function(){ el.className = 'toast'; }, 3200);
  }

  /* ─ Status / badge helpers ───────────────────────────────────────────────── */
  var STATUS_LABELS = {
    new: 'New', mail_1_sent: 'Mail 1 Sent',
    follow_up_1:'FU 1',follow_up_2:'FU 2',follow_up_3:'FU 3',follow_up_4:'FU 4',follow_up_5:'FU 5',
    follow_up_6:'FU 6',follow_up_7:'FU 7',follow_up_8:'FU 8',follow_up_9:'FU 9',follow_up_10:'FU 10',
    responded:'Responded', meeting_scheduled:'Meeting', converted:'Converted', discarded:'Discarded',
  };
  var STATUS_BADGE = {
    new:'badge-gray', mail_1_sent:'badge-blue',
    follow_up_1:'badge-blue',follow_up_2:'badge-blue',follow_up_3:'badge-blue',
    follow_up_4:'badge-blue',follow_up_5:'badge-blue',follow_up_6:'badge-blue',
    follow_up_7:'badge-blue',follow_up_8:'badge-blue',follow_up_9:'badge-blue',follow_up_10:'badge-blue',
    responded:'badge-green', meeting_scheduled:'badge-purple',
    converted:'badge-emerald', discarded:'badge-red',
  };
  var STAGE_LABELS = {
    enquiry_received:'Enquiry', bid_submitted:'Bid Submitted', order_won:'Order Won',
    production:'Production', quality_check:'QC', delivery:'Delivery',
    completed:'Completed', on_hold:'On Hold',
  };
  var STAGE_ORDER = ['enquiry_received','bid_submitted','order_won','production','quality_check','delivery','completed','on_hold'];
  var SENT_STATUSES = ['mail_1_sent','follow_up_1','follow_up_2','follow_up_3','follow_up_4','follow_up_5','follow_up_6','follow_up_7','follow_up_8','follow_up_9','follow_up_10'];

  function statusBadge(s) {
    return '<span class="badge ' + (STATUS_BADGE[s] || 'badge-gray') + '">' + esc(STATUS_LABELS[s] || s) + '</span>';
  }
  function stageBadge(s) {
    var cls = s === 'completed' ? 'badge-emerald' : s === 'on_hold' ? 'badge-red' : s === 'production' ? 'badge-gold' : 'badge-blue';
    return '<span class="badge ' + cls + '">' + esc(STAGE_LABELS[s] || s) + '</span>';
  }
  function sentimentBadge(s) {
    if (!s) return '';
    var cls = s === 'positive' ? 'badge-green' : s === 'negative' ? 'badge-red' : 'badge-gold';
    return '<span class="badge ' + cls + '">' + esc(s) + '</span>';
  }
  function relTime(ts) {
    if (!ts) return '—';
    var diff = (Date.now() - new Date(ts).getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff/60) + 'm ago';
    if (diff < 86400) return Math.floor(diff/3600) + 'h ago';
    return Math.floor(diff/86400) + 'd ago';
  }
  function fmtDate(ts) { if (!ts) return '—'; return new Date(ts).toLocaleDateString(); }
  function fmtMoney(n) { if (n == null) return '—'; return '₹' + Number(n).toLocaleString('en-IN'); }

  /* ─ Nav ──────────────────────────────────────────────────────────────────── */
  function setView(v) {
    if (v === 'capture' && state.view === 'sheets') {
      state.captureTab = 'pdf';
    }
    if (v === 'sheets') state.captureTab = 'sheets';
    state.view = v;
    document.querySelectorAll('.nav-link').forEach(function(a){ a.classList.toggle('active', a.dataset.view === v); });
    renderView(v);
  }

  /* ─ Auth ─────────────────────────────────────────────────────────────────── */
  async function login(username, password) {
    var btn = $('btn-login');
    if (btn) btn.disabled = true;
    try {
      var res = await PS2Api.login(username, password);
      if (!res.ok) { toast(res.data.error || 'Login failed', true); return; }
      PS2Api.setToken(res.data.token);
      await enterApp(res.data.user);
    } finally { if (btn) btn.disabled = false; }
  }

  async function bootSession() {
    var token = PS2Api.getToken();
    if (!token) { show('gate-view'); return; }
    var res = await PS2Api.me();
    if (res.ok) { await enterApp(res.data.user); }
    else { PS2Api.clearToken(); show('gate-view'); }
  }

  async function enterApp(user) {
    state.user = user;
    show('app-shell');
    $('nav-user-name').textContent = user.full_name || user.username;
    $('nav-user-role').textContent = user.role.replace('_', ' ');
    // Hide restricted nav items
    document.querySelectorAll('[data-role]').forEach(function(el) {
      var roles = el.dataset.role.split(',');
      el.classList.toggle('hidden', !roles.includes(user.role));
    });
    // pt_admin only sees settings
    if (user.role === 'pt_admin') { setView('settings'); return; }
    var hash = location.hash.replace(/^#\/?/, '') || 'dashboard';
    setView(hash);
  }

  function togglePassword(inputId, btn) {
    var input = $(inputId);
    if (!input) return;
    var show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    if (btn) btn.textContent = show ? 'Hide' : 'Show';
  }

  function signOut() {
    PS2Api.clearToken();
    state.user = null;
    show('gate-view');
    location.hash = '';
  }

  /* ─ Router ───────────────────────────────────────────────────────────────── */
  function renderView(v) {
    var main = $('main-content');
    if (!main) return;
    main.innerHTML = '<p style="color:var(--muted);padding:20px">Loading…</p>';
    if (v === 'dashboard') renderDashboard();
    else if (v === 'capture') renderCapture();
    else if (v === 'leads') renderLeads();
    else if (v === 'pipeline') renderPipeline();
    else if (v === 'review-drafts') renderReviewDrafts();
    else if (v === 'tracker') renderTracker();
    else if (v === 'mail-config') renderMailConfig();
    else if (v === 'settings') renderSettings();
    else if (v === 'users') renderUsers();
    else if (v === 'outlook') renderOutlook();
    else if (v === 'sheets') {
      state.captureTab = 'sheets';
      state.view = 'sheets';
      renderCapture();
    }
  }

  /* ─────────────────────────────────────────────────────────────────────────
     DASHBOARD
  ──────────────────────────────────────────────────────────────────────────── */
  async function renderDashboard() {
    var main = $('main-content');
    var [statsRes, actRes] = await Promise.all([PS2Api.stats(), PS2Api.activity(20)]);
    var s = (statsRes.ok && statsRes.data.data) || {};
    var activity = (actRes.ok && actRes.data.data) || [];
    var funnel = s.funnel || [];
    var maxFunnel = Math.max(1, ...funnel.map(function(f){ return f.count; }));

    var rate = s.conversion_rate != null ? s.conversion_rate + '%' : '—';
    var rateHint = (s.converted_leads || 0) + ' of ' + (s.contacted_leads || 0) + ' contacted';
    main.innerHTML =
      '<div class="page-head"><div><h1 class="page-title">Dashboard</h1><p class="page-sub">Leadership view — Mail 1s, follow-ups, responses, conversion</p></div></div>' +
      '<div class="kpi-row">' +
        kpi('Mail 1s sent', s.mail_1_sent || 0, 'blue') +
        kpi('Follow-ups sent', s.follow_ups_sent || 0, '') +
        kpi('Responses', s.responses || s.responded_leads || 0, 'green') +
        kpi('Conversion rate', rate, 'gold', rateHint) +
      '</div>' +
      '<div class="kpi-row">' +
        kpi('Total Leads', s.total_leads || 0, '') +
        kpi('Meetings', s.meetings_scheduled || 0, 'purple') +
        kpi('Converted', s.converted_leads || 0, 'gold') +
        kpi('Discarded', s.discarded_leads || 0, '') +
      '</div>' +
      (state.user && state.user.role !== 'pt_admin' ? n8nRunPanel() : '') +
      '<div style="display:grid;grid-template-columns:1fr 340px;gap:18px">' +
        '<div class="panel">' +
          '<div class="panel-head"><h2>Pipeline Funnel</h2></div>' +
          '<div style="padding:18px"><div class="funnel">' +
          funnel.map(function(f){
            var w = Math.round((f.count / maxFunnel) * 100);
            return '<div class="funnel-row"><span class="funnel-label">' + esc(f.label) + '</span>' +
              '<div class="funnel-bar-wrap"><div class="funnel-bar" style="width:' + w + '%"></div></div>' +
              '<span class="funnel-count">' + f.count + '</span></div>';
          }).join('') +
          '</div></div></div>' +
        '<div class="panel">' +
          '<div class="panel-head"><h2>Recent Activity</h2></div>' +
          '<ul class="activity-list">' +
          activity.slice(0,15).map(function(a){
            return '<li class="activity-item"><div class="activity-dot"></div><div><div class="activity-summary">' + esc(a.summary) + '</div><div class="activity-time">' + relTime(a.created_at) + '</div></div></li>';
          }).join('') +
          (activity.length === 0 ? '<li class="activity-item"><div class="activity-dot"></div><div style="color:var(--muted)">No activity yet</div></li>' : '') +
          '</ul></div>' +
      '</div>';
  }

  function kpi(label, val, colorClass, hint) {
    return '<div class="kpi"><div class="kpi-label">' + esc(label) + '</div><div class="kpi-val ' + (colorClass || '') + '">' + val + '</div>' +
      (hint ? '<div class="kpi-hint">' + esc(hint) + '</div>' : '') + '</div>';
  }

  function n8nRunPanel() {
    return '<div class="panel" style="margin-bottom:18px"><div class="panel-head"><h2>n8n automations</h2></div>' +
      '<div style="padding:14px 18px;display:flex;gap:10px;flex-wrap:wrap">' +
        '<button class="btn btn-primary btn-sm" id="n8n-btn-send_email" onclick="window.PS2App.triggerN8n(\'send_email\')">Run email sequence (A)</button>' +
        '<button class="btn btn-sm" id="n8n-btn-process_replies" onclick="window.PS2App.triggerN8n(\'process_replies\')">Re-run reply ingest (B)</button>' +
        '<button class="btn btn-sm" id="n8n-btn-sync_sheets" onclick="window.PS2App.triggerN8n(\'sync_sheets\')">Sync Google Sheets (C)</button>' +
      '</div>' +
      '<p style="padding:0 18px 14px;margin:0;font-size:12px;color:var(--muted)">Website enrichment (D) fires automatically when a lead is saved with a website. Workflows must be Active in n8n.</p></div>';
  }

  async function triggerN8n(workflow) {
    var btn = $('n8n-btn-' + workflow);
    var prev = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Running…'; }
    toast('Triggering ' + workflow + '…');
    try {
      var res = await PS2Api.triggerN8n({ workflow: workflow });
      if (!res.ok) { toast(res.data.error || 'Trigger failed — is the webhook URL set and workflow Active?', true); return; }
      toast('Triggered ' + workflow + ' → n8n');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = prev; }
    }
  }

  /* ─────────────────────────────────────────────────────────────────────────
     CAPTURE (PDF cards, Excel, Google Sheets)
  ──────────────────────────────────────────────────────────────────────────── */
  var EXCEL_FIELDS = [
    { key: 'full_name', label: 'Full name' },
    { key: 'first_name', label: 'First name' },
    { key: 'last_name', label: 'Last name' },
    { key: 'company', label: 'Company' },
    { key: 'designation', label: 'Designation' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'website', label: 'Website' },
    { key: 'notes', label: 'Notes' },
    { key: 'custom_intro', label: 'Custom intro' },
  ];
  var FIELD_ALIASES = {
    full_name: ['name','full name','contact','contact name','lead name','person'],
    first_name: ['first','first name','firstname','given name'],
    last_name: ['last','last name','lastname','surname'],
    company: ['company','organisation','organization','firm','account','org'],
    designation: ['designation','title','job title','role','position'],
    email: ['email','e-mail','mail','email address','e mail'],
    phone: ['phone','mobile','tel','telephone','contact number','cell'],
    website: ['website','url','web','site','www'],
    notes: ['notes','note','comments','remark','remarks'],
    custom_intro: ['intro','custom intro','met at','source note','context'],
  };

  async function renderCapture() {
    var main = $('main-content');
    var tab = state.captureTab || 'pdf';
    var batchesRes = await PS2Api.uploadBatches();
    var batches = (batchesRes.ok && batchesRes.data.data) || [];
    var tabs = [
      { id: 'pdf', label: 'Business cards (PDF)' },
      { id: 'excel', label: 'Excel / CSV' },
      { id: 'sheets', label: 'Google Sheets' },
    ];
    main.innerHTML =
      '<div class="page-head"><div><h1 class="page-title">Capture</h1>' +
        '<p class="page-sub">Exhibition cards, spreadsheet upload, and live sheet sync into the master DB</p></div>' +
        '<button class="btn btn-primary btn-sm" onclick="window.PS2App.openAddLead()">+ Add one lead</button></div>' +
      '<div class="tabs">' +
        tabs.map(function(t){
          return '<button class="tab' + (tab===t.id?' active':'') + '" data-tab="' + t.id + '">' + t.label + '</button>';
        }).join('') +
      '</div>' +
      '<div id="capture-body"></div>' +
      (batches.length ? '<div class="panel" style="margin-top:18px"><div class="panel-head"><h2>Recent uploads</h2></div>' +
        '<table class="data-table"><thead><tr><th>File</th><th>Source</th><th>Imported</th><th>Duplicates</th><th>When</th></tr></thead><tbody>' +
        batches.map(function(b){
          return '<tr><td>' + esc(b.filename || '—') + '</td><td>' + esc(b.source_type) + '</td>' +
            '<td>' + (b.imported_count||0) + ' / ' + (b.total_records||0) + '</td>' +
            '<td>' + (b.duplicate_count||0) + '</td><td>' + relTime(b.created_at) + '</td></tr>';
        }).join('') +
        '</tbody></table></div>' : '');

    main.querySelectorAll('.tab').forEach(function(btn){
      btn.addEventListener('click', function(){
        state.captureTab = btn.dataset.tab;
        if (btn.dataset.tab === 'sheets') {
          state.view = 'sheets';
          location.hash = 'sheets';
        } else {
          state.view = 'capture';
          location.hash = 'capture';
        }
        document.querySelectorAll('.nav-link').forEach(function(a){
          a.classList.toggle('active', a.dataset.view === state.view);
        });
        renderCapture();
      });
    });
    var body = $('capture-body');
    if (tab === 'excel') renderExcelCapture(body);
    else if (tab === 'sheets') renderSheetsCapture(body);
    else renderPdfCapture(body);
  }

  function renderPdfCapture(el) {
    el.innerHTML =
      '<div class="panel"><div class="panel-head"><h2>PDF / image business cards</h2></div>' +
        '<div style="padding:18px">' +
          '<div class="drop-zone" id="pdf-drop">' +
            '<div class="drop-zone-icon">📇</div>' +
            '<p><strong>Drop exhibition cards here</strong></p>' +
            '<p>PDF, PNG, or JPG — queued for n8n extraction, or add the contact manually</p>' +
            '<input type="file" id="pdf-file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/*" multiple hidden />' +
          '</div>' +
          '<p id="pdf-status" style="font-size:13px;color:var(--muted);margin:12px 0 0"></p>' +
        '</div></div>';
    bindDropZone($('pdf-drop'), $('pdf-file'), handlePdfFiles);
  }

  function renderExcelCapture(el) {
    var ex = state.excel;
    var mappingHtml = '';
    if (ex.headers.length) {
      mappingHtml =
        '<div class="map-grid">' +
        EXCEL_FIELDS.map(function(f){
          var sel = ex.mapping[f.key] || '';
          return '<label class="field-label">' + esc(f.label) + '</label>' +
            '<select data-map="' + f.key + '"><option value="">— skip —</option>' +
            ex.headers.map(function(h, i){
              return '<option value="' + i + '"' + (String(sel)===String(i)?' selected':'') + '>' + esc(h || ('Column ' + (i+1))) + '</option>';
            }).join('') + '</select>';
        }).join('') +
        '</div>' +
        '<div style="padding:0 18px 12px;display:flex;gap:8px;align-items:center">' +
          '<button class="btn btn-primary" id="btn-import-excel">Import ' + ex.rows.length + ' rows</button>' +
          '<span id="excel-import-status" style="font-size:13px;color:var(--muted)"></span>' +
        '</div>' +
        '<div class="panel" style="margin:0 18px 18px"><table class="data-table"><thead><tr>' +
          ex.headers.slice(0,8).map(function(h){ return '<th>' + esc(h) + '</th>'; }).join('') +
        '</tr></thead><tbody>' +
        ex.rows.slice(0,8).map(function(r){
          return '<tr>' + r.slice(0,8).map(function(c){ return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>';
        }).join('') +
        '</tbody></table></div>';
    }
    el.innerHTML =
      '<div class="panel"><div class="panel-head"><h2>Excel or CSV</h2></div>' +
        '<div style="padding:18px">' +
          '<div class="drop-zone" id="xlsx-drop">' +
            '<div class="drop-zone-icon">📊</div>' +
            '<p><strong>Drop a spreadsheet</strong></p>' +
            '<p>.xlsx, .xls, or .csv — map columns, then import into the master DB</p>' +
            '<input type="file" id="xlsx-file" accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden />' +
          '</div>' +
        '</div>' + mappingHtml + '</div>';
    bindDropZone($('xlsx-drop'), $('xlsx-file'), handleExcelFiles);
    el.querySelectorAll('select[data-map]').forEach(function(sel){
      sel.addEventListener('change', function(){
        state.excel.mapping[sel.dataset.map] = sel.value === '' ? '' : Number(sel.value);
      });
    });
    var btn = $('btn-import-excel');
    if (btn) btn.addEventListener('click', submitExcelImport);
  }

  async function renderSheetsCapture(el) {
    var res = await PS2Api.sheetConnections();
    var conns = (res.ok && res.data.data) || [];
    var addBtn = state.user && state.user.role !== 'pt_admin'
      ? '<button class="btn btn-primary btn-sm" onclick="window.PS2App.openAddSheet()">+ Connect Sheet</button>' : '';
    el.innerHTML =
      '<div class="page-head" style="margin-bottom:14px"><div>' +
        '<p class="page-sub" style="margin:0">Website enquiry forms and other live sheets. n8n Workflow C pulls new rows every 6 hours (or the interval you set).</p></div>' + addBtn + '</div>' +
      '<div class="panel"><table class="data-table"><thead><tr><th>Sheet URL</th><th>Tab</th><th>Sync Interval</th><th>Last Synced</th><th>Active</th><th></th></tr></thead><tbody>' +
        conns.map(function(c){
          return '<tr><td style="max-width:220px;overflow:hidden;text-overflow:ellipsis"><a href="' + esc(c.sheet_url) + '" target="_blank" style="color:var(--gold)">' + esc((c.sheet_url||'').slice(0,56)) + '…</a></td>' +
            '<td>' + esc(c.tab_name||'—') + '</td>' +
            '<td>' + c.sync_interval_hours + 'h</td>' +
            '<td>' + relTime(c.last_synced_at) + '</td>' +
            '<td><label><input type="checkbox" ' + (c.is_active?'checked':'') + ' onchange="window.PS2App.toggleSheet(\'' + c.id + '\',this.checked)" /></label></td>' +
            '<td><button class="btn-icon btn-danger" onclick="window.PS2App.toggleSheet(\'' + c.id + '\',false)">✕</button></td></tr>';
        }).join('') +
      (conns.length===0?'<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:24px">No connections yet — website queries land here once a sheet is connected</td></tr>':'') +
      '</tbody></table></div>';
  }

  function bindDropZone(zone, input, onFiles) {
    if (!zone || !input) return;
    zone.addEventListener('click', function(){ input.click(); });
    zone.addEventListener('dragover', function(e){ e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', function(){ zone.classList.remove('drag-over'); });
    zone.addEventListener('drop', function(e){
      e.preventDefault(); zone.classList.remove('drag-over');
      onFiles(e.dataTransfer.files);
    });
    input.addEventListener('change', function(){ onFiles(input.files); });
  }

  function fileToBase64(file) {
    return new Promise(function(resolve, reject){
      var reader = new FileReader();
      reader.onload = function(){
        var s = String(reader.result || '');
        var i = s.indexOf(',');
        resolve(i >= 0 ? s.slice(i + 1) : s);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handlePdfFiles(fileList) {
    var files = Array.prototype.slice.call(fileList || []);
    var status = $('pdf-status');
    if (!files.length) return;
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      if (status) status.textContent = 'Uploading ' + f.name + '…';
      try {
        var b64 = await fileToBase64(f);
        var res = await PS2Api.ingestFile({ filename: f.name, content_type: f.type || 'application/pdf', content_base64: b64 });
        if (!res.ok) { toast(res.data.error || 'Upload failed', true); continue; }
        toast(res.data.data && res.data.data.message ? res.data.data.message : 'Uploaded ' + f.name);
      } catch (err) {
        toast('Could not read ' + f.name, true);
      }
    }
    renderCapture();
  }

  function parseCsv(text) {
    var rows = [];
    var row = [];
    var cur = '';
    var inQ = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (inQ) {
        if (c === '"') {
          if (text[i+1] === '"') { cur += '"'; i++; }
          else inQ = false;
        } else cur += c;
      } else {
        if (c === '"') inQ = true;
        else if (c === ',' || c === '\t') { row.push(cur); cur = ''; }
        else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
        else if (c !== '\r') cur += c;
      }
    }
    if (cur.length || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(function(r){ return r.some(function(x){ return String(x).trim(); }); });
  }

  function autoMapHeaders(headers) {
    var mapping = {};
    var used = {};
    EXCEL_FIELDS.forEach(function(f){
      var aliases = FIELD_ALIASES[f.key] || [f.key];
      for (var i = 0; i < headers.length; i++) {
        if (used[i]) continue;
        var h = String(headers[i] || '').trim().toLowerCase();
        if (aliases.indexOf(h) >= 0) { mapping[f.key] = i; used[i] = true; break; }
      }
    });
    return mapping;
  }

  function loadXlsx(cb) {
    if (window.XLSX) { cb(); return; }
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    s.onload = cb;
    s.onerror = function(){ toast('Could not load spreadsheet parser', true); };
    document.head.appendChild(s);
  }

  async function handleExcelFiles(fileList) {
    var file = fileList && fileList[0];
    if (!file) return;
    var name = file.name || 'upload.csv';
    var isCsv = /\.csv$/i.test(name) || file.type === 'text/csv';
    if (isCsv) {
      var text = await file.text();
      applyExcelGrid(name, parseCsv(text));
      return;
    }
    loadXlsx(function(){
      var reader = new FileReader();
      reader.onload = function(){
        try {
          var wb = window.XLSX.read(new Uint8Array(reader.result), { type: 'array' });
          var sheet = wb.Sheets[wb.SheetNames[0]];
          var grid = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
          applyExcelGrid(name, grid);
        } catch (e) {
          toast('Could not parse spreadsheet', true);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  function applyExcelGrid(filename, grid) {
    var rows = (grid || []).filter(function(r){ return (r||[]).some(function(c){ return String(c).trim(); }); });
    if (rows.length < 2) { toast('Need a header row plus data', true); return; }
    var headers = rows[0].map(function(h){ return String(h || '').trim(); });
    var data = rows.slice(1).map(function(r){
      return headers.map(function(_, i){ return r[i] == null ? '' : String(r[i]).trim(); });
    });
    state.excel = { headers: headers, rows: data, mapping: autoMapHeaders(headers), filename: filename };
    renderCapture();
  }

  async function submitExcelImport() {
    var ex = state.excel;
    var status = $('excel-import-status');
    var leads = ex.rows.map(function(r){
      var o = {};
      EXCEL_FIELDS.forEach(function(f){
        var idx = ex.mapping[f.key];
        if (idx === '' || idx == null) return;
        o[f.key] = r[idx] || '';
      });
      return o;
    }).filter(function(o){ return o.full_name || o.email || o.company || o.phone; });
    if (!leads.length) { toast('Map at least name, email, company, or phone', true); return; }
    if (status) status.textContent = 'Importing ' + leads.length + '…';
    var res = await PS2Api.importLeads({ source: 'excel', filename: ex.filename, leads: leads });
    if (!res.ok) { toast(res.data.error || 'Import failed', true); return; }
    var d = res.data.data || {};
    toast('Imported ' + (d.imported||0) + ' · ' + (d.duplicates||0) + ' duplicates');
    state.excel = { headers: [], rows: [], mapping: {}, filename: '' };
    renderCapture();
  }

  /* ─────────────────────────────────────────────────────────────────────────
     LEADS TABLE
  ──────────────────────────────────────────────────────────────────────────── */
  async function renderLeads() {
    var main = $('main-content');
    var params = 'page=' + state.leadsPage + '&pageSize=50';
    if (state.leadsSearch) params += '&search=' + encodeURIComponent(state.leadsSearch);
    if (state.leadsStatus) params += '&status=' + state.leadsStatus;
    if (state.leadsSource) params += '&source=' + state.leadsSource;
    var res = await PS2Api.listLeads(params);
    var leads = (res.ok && res.data.data && res.data.data.leads) || [];
    var total = (res.ok && res.data.data && res.data.data.total) || 0;
    state.leads = leads;
    state.leadsTotal = total;

    var addBtn = state.user && state.user.role !== 'pt_admin'
      ? '<div style="display:flex;gap:8px">' +
          '<button class="btn btn-sm" onclick="window.PS2App.openLeadUpload()">Upload card / PDF</button>' +
          '<button class="btn btn-primary btn-sm" onclick="window.PS2App.openAddLead()">+ Add Lead</button>' +
        '</div>' : '';

    main.innerHTML =
      '<div class="page-head"><div><h1 class="page-title">Leads</h1><p class="page-sub">Master database · ' + total + ' total</p></div>' + addBtn + '</div>' +
      '<div class="filter-bar">' +
        '<input id="leads-search" placeholder="Search name, company, email…" value="' + esc(state.leadsSearch) + '" />' +
        '<select id="leads-status"><option value="">All statuses</option>' +
          Object.entries(STATUS_LABELS).map(function(e){ return '<option value="' + e[0] + '"' + (state.leadsStatus===e[0]?' selected':'') + '>' + e[1] + '</option>'; }).join('') +
        '</select>' +
        '<select id="leads-source"><option value="">All sources</option>' +
          ['business_card','excel','google_sheet','manual'].map(function(s){ return '<option value="'+s+'"'+(state.leadsSource===s?' selected':'')+'>'+(s==='business_card'?'Business Card':s==='google_sheet'?'Google Sheet':s.charAt(0).toUpperCase()+s.slice(1))+'</option>'; }).join('') +
        '</select>' +
      '</div>' +
      '<div class="panel"><table class="data-table"><thead><tr><th>Name</th><th>Company</th><th>Email</th><th>Status</th><th>Source</th><th>Last Activity</th><th></th></tr></thead><tbody>' +
      leads.map(function(l){
        return '<tr class="clickable" data-id="' + l.id + '">' +
          '<td>' + esc(l.full_name || '—') + '</td>' +
          '<td>' + esc(l.company || '—') + '</td>' +
          '<td>' + esc(l.email || '—') + '</td>' +
          '<td>' + statusBadge(l.status) + '</td>' +
          '<td>' + esc(l.source || '—') + '</td>' +
          '<td>' + relTime(l.last_activity_at) + '</td>' +
          '<td><button class="btn-icon" title="Open">→</button></td>' +
          '</tr>';
      }).join('') +
      (leads.length === 0 ? '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:24px">No leads found</td></tr>' : '') +
      '</tbody></table></div>' +
      (total > 50 ? '<div style="text-align:center;margin-top:12px;color:var(--muted);font-size:13px">' + leads.length + ' of ' + total + ' leads</div>' : '');

    // Filter bindings
    $('leads-search').addEventListener('input', function(){ state.leadsSearch = this.value; state.leadsPage = 1; renderLeads(); });
    $('leads-status').addEventListener('change', function(){ state.leadsStatus = this.value; state.leadsPage = 1; renderLeads(); });
    $('leads-source').addEventListener('change', function(){ state.leadsSource = this.value; state.leadsPage = 1; renderLeads(); });
    // Row click → detail
    main.querySelectorAll('tr[data-id]').forEach(function(tr){
      tr.addEventListener('click', function(){ openLeadDetail(tr.dataset.id); });
    });
  }

  async function openLeadDetail(id) {
    var r = await PS2Api.getLead(id);
    if (!r.ok) { toast('Could not load lead', true); return; }
    var lead = r.data.data.lead;
    var emailsRes = await PS2Api.listEmails(id);
    var emails = (emailsRes.ok && emailsRes.data.data) || [];
    state.selectedLead = lead;
    showLeadPanel(lead, emails);
  }

  function closeDetail() {
    document.querySelectorAll('.detail-backdrop, .detail-panel').forEach(function(el){ el.remove(); });
  }

  function showLeadPanel(lead, emails) {
    closeDetail();
    var locked = state.user && state.user.role === 'pt_admin';
    var isAdmin = state.user && state.user.role === 'sahasra_admin';
    var sortedEmails = (emails || []).slice().sort(function(a, b){
      return new Date(a.sent_at || a.received_at || a.created_at) - new Date(b.sent_at || b.received_at || b.created_at);
    });
    var pendingDraft = sortedEmails.find(function(e){ return e.is_ai_draft && e.status === 'pending_review' && e.direction === 'outbound'; });
    var websiteHtml = lead.website
      ? '<a href="' + esc(lead.website) + '" target="_blank" rel="noopener" style="color:var(--gold)">' + esc(lead.website) + '</a>'
      : '—';
    var attachments = lead.attachments || [];

    var html =
      '<div class="detail-backdrop" id="detail-backdrop"></div>' +
      '<div class="detail-panel" id="detail-panel">' +
        '<div class="detail-header">' +
          '<div><h2>' + esc(lead.full_name || '—') + '</h2><p style="margin:0;color:var(--muted);font-size:13px">' + esc(lead.company || '') + ' · ' + statusBadge(lead.status) + '</p></div>' +
          '<button type="button" class="btn btn-sm btn-ghost" id="btn-close-detail">✕ Close</button>' +
        '</div>' +
        (pendingDraft ? draftCard(pendingDraft, lead, sortedEmails) : '') +
        (lead.status === 'meeting_scheduled' ? meetingOutcomeCard(lead) : '') +
        '<div class="detail-cols">' +
          detailField('Email', lead.email) +
          detailField('Phone', lead.phone) +
          detailField('Designation', lead.designation) +
          detailField('Source', lead.source) +
          '<div class="detail-field"><label>Website</label><span>' + websiteHtml + '</span></div>' +
          detailField('Meeting', lead.meeting_scheduled_at ? fmtDateTime(lead.meeting_scheduled_at) : '—') +
          detailField('Tags', (lead.tags||[]).join(', ') || '—') +
          detailField('Last activity', relTime(lead.last_activity_at)) +
        '</div>' +
        (lead.notes ? '<div style="margin-top:14px"><label style="font-size:11px;color:var(--muted);text-transform:uppercase">Notes</label><p style="font-size:13px;margin:4px 0">' + esc(lead.notes) + '</p></div>' : '') +
        (lead.website_summary ? '<div style="margin-top:10px"><label style="font-size:11px;color:var(--muted);text-transform:uppercase">Website summary (AI)</label><p style="font-size:13px;margin:4px 0;color:var(--muted)">' + esc(lead.website_summary) + '</p></div>' : '') +

        '<div class="pipeline-history">' +
          '<h3>Outreach pipeline</h3>' +
          pipelineHistoryHtml(lead, sortedEmails) +
        '</div>' +

        '<div style="margin-top:18px">' +
          '<h3 style="font-size:13px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin:0 0 10px">Attachments</h3>' +
          (attachments.length === 0 ? '<p style="color:var(--muted);font-size:13px;margin:0 0 10px">No photos or PDFs on this lead yet.</p>' : '') +
          attachments.map(function(a){
            return '<div class="attach-row"><span>' + esc(a.filename || 'file') + '</span>' +
              '<span class="attach-meta">' + esc(a.content_type || '') + ' · ' + relTime(a.uploaded_at) +
              (a.ocr_requested ? ' · OCR requested' : '') + '</span></div>';
          }).join('') +
          (!locked ? '<div style="margin-top:10px"><button type="button" class="btn btn-sm" onclick="window.PS2App.openLeadUpload(\'' + lead.id + '\')">Upload photo / PDF</button></div>' : '') +
        '</div>' +

        (!locked ? '<div class="lead-actions">' +
          '<p class="lead-actions-hint"><strong>Schedule meeting</strong> — use after a positive reply or when the prospect agrees to talk. Sets status to Meeting; after the call, convert or discard.</p>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
            '<button type="button" class="btn btn-sm" onclick="window.PS2App.openEditLead(\'' + lead.id + '\')">Edit lead</button>' +
            (lead.status !== 'meeting_scheduled' && lead.status !== 'converted' && lead.status !== 'discarded'
              ? '<button type="button" class="btn btn-sm" onclick="window.PS2App.scheduleMeeting(\'' + lead.id + '\')">Schedule meeting</button>' : '') +
            (lead.status !== 'converted'
              ? '<button type="button" class="btn btn-sm btn-primary" onclick="window.PS2App.convertLead(\'' + lead.id + '\')">Mark converted</button>' : '') +
            (lead.status !== 'discarded'
              ? '<button type="button" class="btn btn-sm btn-danger" onclick="window.PS2App.discardLead(\'' + lead.id + '\')">Discard</button>' : '') +
            '<button type="button" class="btn btn-sm btn-ghost" onclick="window.PS2App.editLeadWebsite(\'' + lead.id + '\')">Edit website</button>' +
            (isAdmin
              ? '<button type="button" class="btn btn-sm btn-danger" onclick="window.PS2App.deleteLead(\'' + lead.id + '\')">Delete lead</button>' : '') +
          '</div></div>' : '') +

        '<div class="email-timeline" style="margin-top:22px">' +
          '<h3 style="font-size:13px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">Email detail</h3>' +
          (sortedEmails.length === 0 ? '<p style="color:var(--muted);font-size:13px">No emails recorded yet.</p>' : '') +
          sortedEmails.map(function(e){
            var dir = e.direction === 'inbound' ? '← Reply' : '→ Outbound';
            var dirColor = e.direction === 'inbound' ? 'var(--green)' : 'var(--gold)';
            return '<div class="email-item"><div class="email-meta">' +
              '<span style="color:' + dirColor + ';font-weight:600">' + dir + '</span>' +
              (e.sequence_step != null && e.sequence_step !== '' ? '<span>' + esc(sequenceLabel(e.sequence_step)) + '</span>' : '') +
              sentimentBadge(e.sentiment) +
              '<span class="badge ' + (e.status==='sent'?'badge-green':e.status==='pending_review'?'badge-gold':'badge-gray') + '">' + e.status + '</span>' +
              '<span>' + fmtDateTime(e.sent_at || e.received_at || e.created_at) + '</span></div>' +
              '<div class="email-subject">' + esc(e.subject || '(no subject)') + '</div>' +
              '<div class="email-body">' + esc((e.body||'').slice(0,240)) + ((e.body||'').length>240?'…':'') + '</div></div>';
          }).join('') +
        '</div>' +
      '</div>';

    document.body.insertAdjacentHTML('beforeend', html);
    $('btn-close-detail').addEventListener('click', function(e){ e.preventDefault(); closeDetail(); });
    $('detail-backdrop').addEventListener('click', closeDetail);
  }

  function sequenceLabel(step) {
    var n = Number(step);
    if (n === 1) return 'Mail 1';
    if (n > 1) return 'Follow-up ' + (n - 1);
    return 'Step ' + step;
  }

  function fmtDateTime(ts) {
    if (!ts) return '—';
    try {
      return new Date(ts).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch (_) { return String(ts); }
  }

  function isOutboundSent(e) {
    if (!e || e.direction !== 'outbound') return false;
    if (e.status === 'sent') return true;
    if (e.sent_at && e.status !== 'rejected' && e.status !== 'pending_review' && e.status !== 'draft') return true;
    return false;
  }

  function pipelineHistoryHtml(lead, emails) {
    var events = [];
    events.push({
      t: lead.created_at,
      title: 'Lead created',
      detail: 'Source: ' + (lead.source || '—'),
      kind: 'created',
    });

    (emails || []).filter(isOutboundSent).forEach(function(e){
      events.push({
        t: e.sent_at || e.created_at,
        title: sequenceLabel(e.sequence_step != null ? e.sequence_step : 1) + ' sent',
        detail: e.subject || '',
        kind: 'sent',
      });
    });

    (emails || []).filter(function(e){ return e.direction === 'inbound'; })
      .forEach(function(e){
        events.push({
          t: e.received_at || e.created_at,
          title: 'Reply received',
          detail: (e.sentiment ? 'Sentiment: ' + e.sentiment + '. ' : '') + (e.subject || ''),
          kind: 'reply',
        });
      });

    if (lead.meeting_scheduled_at) {
      events.push({
        t: lead.meeting_scheduled_at,
        title: 'Meeting scheduled',
        detail: fmtDateTime(lead.meeting_scheduled_at),
        kind: 'meeting',
      });
    }
    if (lead.status === 'converted') {
      events.push({ t: lead.updated_at || lead.last_activity_at, title: 'Converted', detail: 'Moved to client tracker', kind: 'converted' });
    }
    if (lead.status === 'discarded') {
      events.push({ t: lead.updated_at || lead.last_activity_at, title: 'Discarded', detail: '', kind: 'discarded' });
    }

    events.sort(function(a, b){
      var ta = a.t ? new Date(a.t).getTime() : 0;
      var tb = b.t ? new Date(b.t).getTime() : 0;
      return ta - tb;
    });

    return '<ul class="pipe-list">' + events.map(pipeItem).join('') + '</ul>';
  }

  function pipeItem(ev) {
    return '<li class="pipe-item pipe-' + esc(ev.kind) + '">' +
      '<div class="pipe-dot"></div>' +
      '<div><div class="pipe-title">' + esc(ev.title) + '</div>' +
      (ev.detail ? '<div class="pipe-detail">' + esc(ev.detail) + '</div>' : '') +
      '<div class="pipe-time">' + fmtDateTime(ev.t) + '</div></div></li>';
  }

  function meetingOutcomeCard(lead) {
    return '<div class="meeting-outcome">' +
      '<h4 style="margin:0 0 6px">After the meeting</h4>' +
      '<p style="margin:0 0 12px;font-size:13px;color:var(--muted)">Is this client moving forward with Sahasra?</p>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
        '<button class="btn btn-sm btn-primary" onclick="window.PS2App.convertLead(\'' + lead.id + '\')">Yes — convert to project</button>' +
        '<button class="btn btn-sm btn-danger" onclick="window.PS2App.discardLead(\'' + lead.id + '\')">No — discard</button>' +
      '</div></div>';
  }

  function findRelatedInbound(draft, emails) {
    if (draft && draft.related_inbound) return draft.related_inbound;
    var list = emails || [];
    var inbound = list.filter(function(e){ return e.direction === 'inbound'; });
    if (!inbound.length) return null;
    if (draft && draft.thread_id) {
      var byThread = inbound.filter(function(e){ return e.thread_id === draft.thread_id; });
      if (byThread.length) inbound = byThread;
    }
    inbound.sort(function(a, b){
      return new Date(b.received_at || b.created_at) - new Date(a.received_at || a.created_at);
    });
    return inbound[0] || null;
  }

  function inboundSnippetHtml(inbound) {
    if (!inbound) return '<div class="inbound-snippet muted">No related inbound email found for this draft.</div>';
    return '<div class="inbound-snippet">' +
      '<div class="inbound-snippet-label">Original inbound email</div>' +
      '<div class="email-meta" style="margin-bottom:6px">' +
        '<span style="color:var(--green);font-weight:600">← Reply</span>' +
        sentimentBadge(inbound.sentiment) +
        '<span>' + fmtDateTime(inbound.received_at || inbound.created_at) + '</span>' +
      '</div>' +
      '<div class="email-subject">' + esc(inbound.subject || '(no subject)') + '</div>' +
      '<div class="email-body">' + esc((inbound.body || '').slice(0, 360)) + ((inbound.body || '').length > 360 ? '…' : '') + '</div>' +
    '</div>';
  }

  function draftCard(email, lead, emails) {
    var inbound = findRelatedInbound(email, emails);
    return '<div class="draft-card">' +
      '<h4>AI Draft — Pending Review</h4>' +
      inboundSnippetHtml(inbound) +
      '<div class="inbound-snippet-label" style="margin-top:10px">AI draft</div>' +
      '<div class="draft-body">' + esc((email.body||'').slice(0,400)) + '</div>' +
      '<div style="display:flex;gap:8px">' +
        '<button class="btn btn-sm btn-primary" onclick="window.PS2App.approveDraft(\'' + email.id + '\',\'' + lead.id + '\')">Approve & Queue</button>' +
        '<button class="btn btn-sm btn-danger" onclick="window.PS2App.rejectDraft(\'' + email.id + '\',\'' + lead.id + '\')">Reject</button>' +
      '</div></div>';
  }

  function detailField(label, val) {
    return '<div class="detail-field"><label>' + label + '</label><span>' + esc(val || '—') + '</span></div>';
  }

  /* ─────────────────────────────────────────────────────────────────────────
     PIPELINE (Kanban + Funnel toggle)
  ──────────────────────────────────────────────────────────────────────────── */
  async function renderPipeline() {
    var main = $('main-content');
    var res = await PS2Api.listLeads('pageSize=200');
    var leads = (res.ok && res.data.data && res.data.data.leads) || [];

    var columns = [
      { key: 'new', label: 'New' },
      { key: 'mail_1_sent', label: 'Mail 1 Sent' },
      { key: 'follow_up_1', label: 'FU 1' },
      { key: 'follow_up_2', label: 'FU 2' },
      { key: 'follow_up_3', label: 'FU 3' },
      { key: 'follow_up_4', label: 'FU 4' },
      { key: 'follow_up_5', label: 'FU 5' },
      { key: 'later_fus', label: 'Later FUs', match: ['follow_up_6','follow_up_7','follow_up_8','follow_up_9','follow_up_10'] },
      { key: 'responded', label: 'Responded' },
      { key: 'meeting_scheduled', label: 'Meeting' },
      { key: 'converted', label: 'Converted' },
      { key: 'discarded', label: 'Discarded' },
    ];

    function leadsForCol(col) {
      if (col.match) return leads.filter(function(l){ return col.match.indexOf(l.status) !== -1; });
      return leads.filter(function(l){ return l.status === col.key; });
    }

    main.innerHTML =
      '<div class="page-head"><div><h1 class="page-title">Pipeline</h1><p class="page-sub">Click a card to open lead detail</p></div></div>' +
      '<div class="tabs"><button class="tab active" onclick="this.parentElement.querySelectorAll(\'.tab\').forEach(t=>t.classList.remove(\'active\')); this.classList.add(\'active\'); document.getElementById(\'pipeline-kanban\').classList.remove(\'hidden\'); document.getElementById(\'pipeline-funnel\').classList.add(\'hidden\')">Kanban</button>' +
      '<button class="tab" onclick="this.parentElement.querySelectorAll(\'.tab\').forEach(t=>t.classList.remove(\'active\')); this.classList.add(\'active\'); document.getElementById(\'pipeline-kanban\').classList.add(\'hidden\'); document.getElementById(\'pipeline-funnel\').classList.remove(\'hidden\')">Funnel</button></div>' +
      '<div id="pipeline-kanban" class="kanban-board">' +
        columns.map(function(col){
          var colLeads = leadsForCol(col);
          return '<div class="kanban-col">' +
            '<div class="kanban-col-head">' + esc(col.label) + '<span style="color:var(--muted)">' + colLeads.length + '</span></div>' +
            '<div class="kanban-col-body">' +
              colLeads.map(function(l){
                return '<div class="kanban-card" role="button" tabindex="0" onclick="window.PS2App.openLead(\'' + l.id + '\')">' +
                  '<div class="card-name">' + esc(l.full_name || '—') + '</div>' +
                  '<div class="card-company">' + esc(l.company || '') + '</div>' +
                  (col.key === 'later_fus' || (col.key && col.key.indexOf('follow_up') === 0)
                    ? '<div class="card-val">' + esc(STATUS_LABELS[l.status] || l.status) + '</div>' : '') +
                  '</div>';
              }).join('') +
              (colLeads.length === 0 ? '<p style="color:var(--muted);font-size:12px;text-align:center;margin:8px 0">Empty</p>' : '') +
            '</div></div>';
        }).join('') +
      '</div>' +
      '<div id="pipeline-funnel" class="hidden"><div class="panel"><div class="panel-head"><h2>Status Funnel</h2></div><div style="padding:20px"><div class="funnel">' +
        columns.map(function(col){
          var count = leadsForCol(col).length;
          var w = Math.round((count / Math.max(1, leads.length)) * 100);
          return '<div class="funnel-row"><span class="funnel-label">' + esc(col.label) + '</span><div class="funnel-bar-wrap"><div class="funnel-bar" style="width:' + w + '%"></div></div><span class="funnel-count">' + count + '</span></div>';
        }).join('') +
      '</div></div></div></div>';
  }

  /* ─────────────────────────────────────────────────────────────────────────
     REVIEW DRAFTS
  ──────────────────────────────────────────────────────────────────────────── */
  async function renderReviewDrafts() {
    var main = $('main-content');
    var res = await PS2Api.reviewDrafts();
    var drafts = (res.ok && res.data.data) || [];
    state.reviewDrafts = drafts;

    main.innerHTML =
      '<div class="page-head"><div><h1 class="page-title">Review Drafts</h1><p class="page-sub">AI-generated reply drafts awaiting approval</p></div></div>' +
      (drafts.length === 0 ? '<div class="panel"><div style="padding:32px;text-align:center;color:var(--muted)">No pending drafts</div></div>' : '') +
      drafts.map(function(draft){
        var lead = draft.ps2_leads || {};
        var inbound = draft.related_inbound || null;
        return '<div class="review-card">' +
          '<div class="review-card-head">' +
            '<div><h3>' + esc(lead.full_name || lead.company || 'Unknown') + ' — ' + esc(lead.company || '') + '</h3>' +
            '<p style="margin:2px 0;font-size:12px;color:var(--muted)">' + esc(draft.subject || '') + '</p></div>' +
            sentimentBadge(draft.sentiment) +
          '</div>' +
          inboundSnippetHtml(inbound) +
          '<div class="inbound-snippet-label" style="margin-top:12px">AI draft</div>' +
          '<div class="draft-body">' + esc(draft.body || '') + '</div>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
            '<button class="btn btn-sm btn-primary" onclick="window.PS2App.approveDraft(\'' + draft.id + '\',\'' + lead.id + '\')">Approve & Queue</button>' +
            '<button class="btn btn-sm" onclick="window.PS2App.editDraft(\'' + draft.id + '\')">Edit</button>' +
            '<button class="btn btn-sm btn-danger" onclick="window.PS2App.rejectDraft(\'' + draft.id + '\',\'' + lead.id + '\')">Reject</button>' +
          '</div></div>';
      }).join('');
  }

  /* ─────────────────────────────────────────────────────────────────────────
     CLIENT TRACKER
  ──────────────────────────────────────────────────────────────────────────── */
  async function renderTracker() {
    var main = $('main-content');
    var res = await PS2Api.listProjects();
    var projects = (res.ok && res.data.data) || [];
    state.projects = projects;

    var addBtn = state.user && state.user.role !== 'pt_admin'
      ? '<button class="btn btn-primary btn-sm" onclick="window.PS2App.openAddProject()">+ New Project</button>' : '';

    main.innerHTML =
      '<div class="page-head"><div><h1 class="page-title">Client Tracker</h1><p class="page-sub">Project pipeline — ' + projects.length + ' projects</p></div>' + addBtn + '</div>' +
      '<div class="tabs"><button class="tab active" onclick="this.parentElement.querySelectorAll(\'.tab\').forEach(t=>t.classList.remove(\'active\')); this.classList.add(\'active\'); document.getElementById(\'tracker-kanban\').classList.remove(\'hidden\'); document.getElementById(\'tracker-table\').classList.add(\'hidden\')">Kanban</button>' +
      '<button class="tab" onclick="this.parentElement.querySelectorAll(\'.tab\').forEach(t=>t.classList.remove(\'active\')); this.classList.add(\'active\'); document.getElementById(\'tracker-kanban\').classList.add(\'hidden\'); document.getElementById(\'tracker-table\').classList.remove(\'hidden\')">Table</button></div>' +
      '<div id="tracker-kanban" class="kanban-board">' +
        STAGE_ORDER.slice(0,7).map(function(stage){
          var cols = projects.filter(function(p){ return p.stage === stage; });
          return '<div class="kanban-col"><div class="kanban-col-head">' + esc(STAGE_LABELS[stage]||stage) + '<span style="color:var(--muted)">' + cols.length + '</span></div>' +
            '<div class="kanban-col-body">' +
              cols.map(function(p){
                return '<div class="kanban-card" onclick="window.PS2App.openProject(\'' + p.id + '\')">' +
                  '<div class="card-name">' + esc(p.project_name) + '</div>' +
                  '<div class="card-company">' + esc(p.client_name) + '</div>' +
                  (p.order_value ? '<div class="card-val">' + fmtMoney(p.order_value) + '</div>' : '') +
                  '</div>';
              }).join('') +
              (cols.length === 0 ? '<p style="color:var(--muted);font-size:12px;text-align:center;margin:8px 0">Empty</p>' : '') +
            '</div></div>';
        }).join('') +
      '</div>' +
      '<div id="tracker-table" class="hidden"><div class="panel"><table class="data-table"><thead><tr><th>Client</th><th>Project</th><th>Order Value</th><th>Stage</th><th>Target Date</th><th></th></tr></thead><tbody>' +
        projects.map(function(p){
          return '<tr class="clickable" onclick="window.PS2App.openProject(\'' + p.id + '\')">' +
            '<td>' + esc(p.client_name) + '</td>' +
            '<td>' + esc(p.project_name) + '</td>' +
            '<td>' + fmtMoney(p.order_value) + '</td>' +
            '<td>' + stageBadge(p.stage) + '</td>' +
            '<td>' + fmtDate(p.target_date) + '</td>' +
            '<td><button class="btn-icon">→</button></td></tr>';
        }).join('') +
      '</tbody></table></div></div>';
  }

  /* ─────────────────────────────────────────────────────────────────────────
     MAIL CONFIG
  ──────────────────────────────────────────────────────────────────────────── */
  async function renderMailConfig() {
    var main = $('main-content');
    var res = await PS2Api.mailConfig();
    var steps = (res.ok && res.data.data) || [];
    state.mailConfig = steps;
    var isAdmin = state.user && state.user.role === 'sahasra_admin';

    main.innerHTML =
      '<div class="page-head"><div><h1 class="page-title">Mail Configuration</h1><p class="page-sub">Email sequence — default active: Mail 1 + Follow-ups 1–4 (later steps optional)</p></div></div>' +
      '<div class="panel"><table class="data-table"><thead><tr><th>#</th><th>Label</th><th>Day Offset</th><th>Active</th><th></th></tr></thead><tbody class="mail-steps-body">' +
        steps.map(function(s){
          return '<tr class="mail-step-row" data-step="' + s.step_number + '">' +
            '<td class="step-num">' + s.step_number + '</td>' +
            '<td>' + esc(s.label) + '</td>' +
            '<td>' + (isAdmin ? '<input type="number" class="step-offset" value="' + s.day_offset + '" min="0" style="width:65px" />' : s.day_offset + ' days') + '</td>' +
            '<td><label style="cursor:pointer"><input type="checkbox" class="step-active"' + (s.is_active?' checked':'') + (isAdmin?'':' disabled') + ' /> Active</label></td>' +
            (isAdmin ? '<td><button class="btn btn-sm" onclick="window.PS2App.editMailStep(' + s.step_number + ')">Edit Template</button></td>' : '<td></td>') +
            '</tr>';
        }).join('') +
      '</tbody></table>' +
      (isAdmin ? '<div style="padding:14px"><button class="btn btn-primary" onclick="window.PS2App.saveMailConfig()">Save Changes</button></div>' : '') +
      '</div>';
  }

  /* ─────────────────────────────────────────────────────────────────────────
     SETTINGS (pt_admin only)
  ──────────────────────────────────────────────────────────────────────────── */
  async function renderSettings() {
    var main = $('main-content');
    var res = await PS2Api.getSettings();
    var s = (res.ok && res.data.data) || {};
    var h = s.health || {};

    main.innerHTML =
      '<div class="page-head"><div><h1 class="page-title">System Settings</h1><p class="page-sub">PowerhouseTech admin — n8n config, prompts, health</p></div></div>' +

      '<div class="settings-card">' +
        '<h3>System Health</h3>' +
        healthRow('n8n API Key', h.n8n_api_key_configured) +
        healthRow('Anthropic API Key', h.anthropic_key_configured) +
        healthRow('Supabase Service Key', h.supabase_service_key_configured) +
      '</div>' +

      '<div class="settings-card">' +
        '<h3>n8n Webhook URLs</h3>' +
        webhookField('Send Email Webhook (Workflow A)', 'wh-send-email', s.n8n_webhooks && s.n8n_webhooks.send_email) +
        webhookField('Reply Processing Webhook (Workflow B)', 'wh-process-replies', s.n8n_webhooks && s.n8n_webhooks.process_replies) +
        webhookField('Google Sheets Sync Webhook (Workflow C)', 'wh-sync-sheets', s.n8n_webhooks && s.n8n_webhooks.sync_sheets) +
        webhookField('Website Enrichment Webhook (Workflow D)', 'wh-enrich-website', s.n8n_webhooks && s.n8n_webhooks.enrich_website) +
        webhookField('PDF Card Extraction Webhook (optional)', 'wh-extract-pdf', s.n8n_webhooks && s.n8n_webhooks.extract_pdf) +
        '<p style="font-size:12px;color:var(--muted);margin:8px 0 0">Reply ingestion is polled by n8n (Gmail every 15 min). The B webhook is for a manual re-run only.</p>' +
      '</div>' +

      '<div class="settings-card">' +
        '<h3>n8n API key</h3>' +
        healthRow('Shared key (n8n ↔ portal)', h.n8n_api_key_configured) +
        '<label style="font-size:12px;color:var(--muted);display:block;margin:10px 0 4px">Set or rotate key (leave blank to keep current)</label>' +
        '<input id="n8n-api-key" type="password" autocomplete="off" style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:9px 12px;color:var(--text);font:inherit;font-size:13px" placeholder="Paste N8N_API_KEY" />' +
      '</div>' +

      '<div class="settings-card">' +
        '<h3>AI Prompt Templates</h3>' +
        promptField('First Email Prompt', 'pt-first-email', s.ai_prompt_first_email) +
        promptField('Reply Draft Prompt', 'pt-reply', s.ai_prompt_reply) +
        promptField('Sentiment Classification Prompt', 'pt-sentiment', s.ai_prompt_sentiment) +
      '</div>' +

      '<div style="margin-top:4px"><button class="btn btn-primary" onclick="window.PS2App.saveSettings()">Save Settings</button></div>' +
      '<div id="settings-msg" style="margin-top:10px;font-size:13px;color:var(--green)"></div>';
  }

  function healthRow(label, ok) {
    return '<div class="health-row"><span>' + label + '</span><span class="' + (ok?'health-ok':'health-miss') + '">' + (ok?'✓ Configured':'✗ Missing') + '</span></div>';
  }
  function webhookField(label, id, val) {
    return '<div style="margin-bottom:12px"><label style="font-size:12px;color:var(--muted);display:block;margin-bottom:4px">' + label + '</label>' +
      '<input id="' + id + '" style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:9px 12px;color:var(--text);font:inherit;font-size:13px" value="' + esc(val||'') + '" placeholder="https://n8n…/webhook/…" /></div>';
  }
  function promptField(label, id, val) {
    return '<div style="margin-bottom:12px"><label style="font-size:12px;color:var(--muted);display:block;margin-bottom:4px">' + label + '</label>' +
      '<textarea id="' + id + '" rows="3" style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:9px 12px;color:var(--text);font:inherit;font-size:13px;resize:vertical">' + esc(val||'') + '</textarea></div>';
  }

  /* ─────────────────────────────────────────────────────────────────────────
     USERS / OUTLOOK / SHEETS (admin panels)
  ──────────────────────────────────────────────────────────────────────────── */
  async function renderUsers() {
    if (!state.user || state.user.role !== 'sahasra_admin') return;
    var main = $('main-content');
    var res = await PS2Api.listUsers();
    var users = (res.ok && res.data.data) || [];
    main.innerHTML =
      '<div class="page-head"><div><h1 class="page-title">Users</h1></div>' +
        '<button class="btn btn-primary btn-sm" onclick="window.PS2App.openAddUser()">+ Add User</button></div>' +
      '<div class="panel"><table class="data-table"><thead><tr><th>Username</th><th>Name</th><th>Role</th><th>Outlook</th><th>Active</th><th></th></tr></thead><tbody>' +
        users.map(function(u){
          return '<tr><td>' + esc(u.username) + '</td><td>' + esc(u.full_name||'') + '</td><td>' + esc(u.role) + '</td>' +
            '<td>' + esc(u.outlook_account||'—') + '</td>' +
            '<td>' + (u.is_active ? '<span class="badge badge-green">Active</span>' : '<span class="badge badge-gray">Inactive</span>') + '</td>' +
            '<td><button class="btn-icon" onclick="window.PS2App.deactivateUser(\'' + u.id + '\')">🗑</button></td></tr>';
        }).join('') +
      '</tbody></table></div>';
  }

  async function renderOutlook() {
    var main = $('main-content');
    var res = await PS2Api.outlookAccounts();
    var accounts = (res.ok && res.data.data) || [];
    main.innerHTML =
      '<div class="page-head"><div><h1 class="page-title">Outlook Accounts</h1><p class="page-sub">Connected via n8n OAuth — configured in n8n credentials</p></div></div>' +
      '<div class="panel"><table class="data-table"><thead><tr><th>User</th><th>Email</th><th>Status</th></tr></thead><tbody>' +
        accounts.map(function(a){
          return '<tr><td>' + esc(a.display_name||'') + '</td><td>' + esc(a.email||'') + '</td>' +
            '<td><span class="badge ' + (a.is_connected?'badge-green':'badge-gray') + '">' + (a.is_connected?'Connected':'Disconnected') + '</span></td></tr>';
        }).join('') +
      (accounts.length===0?'<tr><td colspan="3" style="text-align:center;color:var(--muted);padding:24px">No accounts configured</td></tr>':'') +
      '</tbody></table></div>' +
      '<div class="settings-card" style="margin-top:0"><h3>About Outlook Integration</h3>' +
        '<p style="font-size:13px;color:var(--muted);margin:0">Outlook OAuth is managed inside n8n. Connect accounts there and assign the email address to each user in the Users settings. n8n uses the assigned account to send outreach emails for that user\'s leads.</p>' +
      '</div>';
  }

  async function renderSheets() {
    var main = $('main-content');
    var res = await PS2Api.sheetConnections();
    var conns = (res.ok && res.data.data) || [];
    var addBtn = state.user && state.user.role !== 'pt_admin'
      ? '<button class="btn btn-primary btn-sm" onclick="window.PS2App.openAddSheet()">+ Connect Sheet</button>' : '';
    main.innerHTML =
      '<div class="page-head"><div><h1 class="page-title">Google Sheet Connections</h1></div>' + addBtn + '</div>' +
      '<div class="panel"><table class="data-table"><thead><tr><th>Sheet URL</th><th>Tab</th><th>Sync Interval</th><th>Last Synced</th><th>Active</th><th></th></tr></thead><tbody>' +
        conns.map(function(c){
          return '<tr><td style="max-width:200px;overflow:hidden;text-overflow:ellipsis"><a href="' + esc(c.sheet_url) + '" target="_blank" style="color:var(--gold)">' + esc(c.sheet_url.slice(0,50)) + '…</a></td>' +
            '<td>' + esc(c.tab_name||'—') + '</td>' +
            '<td>' + c.sync_interval_hours + 'h</td>' +
            '<td>' + relTime(c.last_synced_at) + '</td>' +
            '<td><label><input type="checkbox" ' + (c.is_active?'checked':'') + ' onchange="window.PS2App.toggleSheet(\'' + c.id + '\',this.checked)" /></label></td>' +
            '<td><button class="btn-icon btn-danger" onclick="window.PS2App.toggleSheet(\'' + c.id + '\',false)">✕</button></td></tr>';
        }).join('') +
      (conns.length===0?'<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:24px">No connections yet</td></tr>':'') +
      '</tbody></table></div>';
  }

  /* ─────────────────────────────────────────────────────────────────────────
     MODALS (Add Lead, Add Project, Add User, Mail Template)
  ──────────────────────────────────────────────────────────────────────────── */
  function openModal(html) {
    closeModal();
    document.body.insertAdjacentHTML('beforeend', '<div class="modal-backdrop" id="global-modal">' + html + '</div>');
    $('global-modal').addEventListener('click', function(e){ if(e.target === this) closeModal(); });
  }
  function closeModal() {
    var m = $('global-modal');
    if (m) m.remove();
  }

  function leadContactValid(fullName, email, company) {
    if (!fullName) return 'Full name is required';
    if (!email && !company) return 'Email or company is required';
    return null;
  }

  function leadFormFields(prefix, lead) {
    lead = lead || {};
    return '<label class="field-label">Full Name *<input id="' + prefix + '-name" value="' + esc(lead.full_name || '') + '" placeholder="Priya Sharma" required /></label>' +
      '<label class="field-label">Company<input id="' + prefix + '-company" value="' + esc(lead.company || '') + '" placeholder="Acme Corp" /></label>' +
      '<label class="field-label">Email<input id="' + prefix + '-email" type="email" value="' + esc(lead.email || '') + '" /></label>' +
      '<p style="font-size:12px;color:var(--muted);margin:-6px 0 10px">Require full name and either email or company.</p>' +
      '<label class="field-label">Phone<input id="' + prefix + '-phone" value="' + esc(lead.phone || '') + '" /></label>' +
      '<label class="field-label">Designation<input id="' + prefix + '-desig" value="' + esc(lead.designation || '') + '" /></label>' +
      '<label class="field-label">Website<input id="' + prefix + '-website" type="url" value="' + esc(lead.website || '') + '" /></label>' +
      '<label class="field-label">Source<select id="' + prefix + '-source">' +
        ['manual','business_card','excel','google_sheet'].map(function(s){
          return '<option value="' + s + '"' + ((lead.source || 'manual') === s ? ' selected' : '') + '>' +
            (s === 'business_card' ? 'Business Card' : s === 'google_sheet' ? 'Google Sheet' : s.charAt(0).toUpperCase() + s.slice(1)) +
            '</option>';
        }).join('') +
      '</select></label>' +
      '<label class="field-label">Notes<textarea id="' + prefix + '-notes">' + esc(lead.notes || '') + '</textarea></label>';
  }

  function readLeadForm(prefix) {
    return {
      full_name: ($(prefix + '-name') || {value:''}).value.trim(),
      company: ($(prefix + '-company') || {value:''}).value.trim(),
      email: ($(prefix + '-email') || {value:''}).value.trim(),
      phone: ($(prefix + '-phone') || {value:''}).value.trim(),
      designation: ($(prefix + '-desig') || {value:''}).value.trim(),
      website: ($(prefix + '-website') || {value:''}).value.trim(),
      source: ($(prefix + '-source') || {value:'manual'}).value,
      notes: ($(prefix + '-notes') || {value:''}).value.trim(),
    };
  }

  function openAddLead() {
    openModal('<div class="modal-card"><h2>Add Lead</h2><div class="form-panel">' +
      leadFormFields('nl', { source: 'manual' }) +
      '<div class="form-actions"><button class="btn btn-primary" onclick="window.PS2App.submitAddLead()">Save Lead</button><button class="btn btn-ghost" onclick="window.PS2App.closeModal()">Cancel</button></div>' +
    '</div></div>');
  }

  async function submitAddLead() {
    var body = readLeadForm('nl');
    var err = leadContactValid(body.full_name, body.email, body.company);
    if (err) { toast(err, true); return; }
    var res = await PS2Api.createLead(body);
    if (!res.ok) { toast(res.data.error || 'Failed to save', true); return; }
    toast('Lead saved');
    closeModal();
    if (state.view === 'capture' || state.view === 'sheets') renderCapture();
    else renderLeads();
  }

  function openEditLead(leadId) {
    var lead = state.selectedLead || {};
    if (leadId && lead.id !== leadId) {
      // keep using selectedLead when ids match; otherwise wait for reload
    }
    openModal('<div class="modal-card"><h2>Edit Lead</h2><div class="form-panel">' +
      leadFormFields('el', lead) +
      '<div class="form-actions"><button class="btn btn-primary" onclick="window.PS2App.submitEditLead(\'' + (leadId || lead.id) + '\')">Save changes</button>' +
      '<button class="btn btn-ghost" onclick="window.PS2App.closeModal()">Cancel</button></div>' +
    '</div></div>');
  }

  async function submitEditLead(leadId) {
    var body = readLeadForm('el');
    var err = leadContactValid(body.full_name, body.email, body.company);
    if (err) { toast(err, true); return; }
    var res = await PS2Api.patchLead(leadId, body);
    if (!res.ok) { toast(res.data.error || 'Failed to save', true); return; }
    toast('Lead updated');
    closeModal();
    openLeadDetail(leadId);
  }

  function openAddProject() {
    openModal('<div class="modal-card"><h2>New Project</h2><div class="form-panel">' +
      '<label class="field-label">Client Name<input id="np-client" /></label>' +
      '<label class="field-label">Project Name<input id="np-project" /></label>' +
      '<label class="field-label">Order Value (₹)<input id="np-value" type="number" /></label>' +
      '<label class="field-label">Notes<textarea id="np-notes"></textarea></label>' +
      '<div class="form-actions"><button class="btn btn-primary" onclick="window.PS2App.submitAddProject()">Create</button><button class="btn btn-ghost" onclick="window.PS2App.closeModal()">Cancel</button></div>' +
    '</div></div>');
  }

  async function submitAddProject() {
    var body = {
      client_name: $('np-client').value.trim(),
      project_name: $('np-project').value.trim(),
      order_value: $('np-value').value || null,
      notes: $('np-notes').value.trim(),
    };
    if (!body.client_name || !body.project_name) { toast('Client and project name required', true); return; }
    var res = await PS2Api.createProject(body);
    if (!res.ok) { toast(res.data.error || 'Failed', true); return; }
    toast('Project created');
    closeModal();
    renderTracker();
  }

  function openAddUser() {
    openModal('<div class="modal-card"><h2>Add User</h2><div class="form-panel">' +
      '<label class="field-label">Username<input id="nu-uname" /></label>' +
      '<label class="field-label">Password<input id="nu-pass" type="password" /></label>' +
      '<label class="field-label">Full Name<input id="nu-name" /></label>' +
      '<label class="field-label">Role<select id="nu-role"><option value="sahasra_employee">sahasra_employee</option><option value="sahasra_admin">sahasra_admin</option><option value="pt_admin">pt_admin</option></select></label>' +
      '<label class="field-label">Outlook Account (email)<input id="nu-outlook" type="email" /></label>' +
      '<div class="form-actions"><button class="btn btn-primary" onclick="window.PS2App.submitAddUser()">Create</button><button class="btn btn-ghost" onclick="window.PS2App.closeModal()">Cancel</button></div>' +
    '</div></div>');
  }

  async function submitAddUser() {
    var body = {
      username: $('nu-uname').value.trim(),
      password: $('nu-pass').value,
      full_name: $('nu-name').value.trim(),
      role: $('nu-role').value,
      outlook_account: $('nu-outlook').value.trim() || null,
    };
    if (!body.username || !body.password) { toast('Username and password required', true); return; }
    var res = await PS2Api.createUser(body);
    if (!res.ok) { toast(res.data.error || 'Failed', true); return; }
    toast('User created');
    closeModal();
    renderUsers();
  }

  function openAddSheet() {
    openModal('<div class="modal-card"><h2>Connect Google Sheet</h2><div class="form-panel">' +
      '<label class="field-label">Sheet URL<input id="ns-url" placeholder="https://docs.google.com/spreadsheets/d/…" /></label>' +
      '<label class="field-label">Tab Name<input id="ns-tab" value="Sheet1" /></label>' +
      '<label class="field-label">Sync Interval<select id="ns-interval"><option value="1">Every 1 hour</option><option value="3">Every 3 hours</option><option value="6">Every 6 hours</option><option value="12">Every 12 hours</option><option value="24" selected>Every 24 hours</option></select></label>' +
      '<div class="form-actions"><button class="btn btn-primary" onclick="window.PS2App.submitAddSheet()">Connect</button><button class="btn btn-ghost" onclick="window.PS2App.closeModal()">Cancel</button></div>' +
    '</div></div>');
  }

  async function submitAddSheet() {
    var body = {
      sheet_url: $('ns-url').value.trim(),
      tab_name: $('ns-tab').value.trim() || 'Sheet1',
      sync_interval_hours: parseInt($('ns-interval').value),
    };
    if (!body.sheet_url) { toast('URL required', true); return; }
    var res = await PS2Api.createSheetConnection(body);
    if (!res.ok) { toast(res.data.error || 'Failed', true); return; }
    toast('Connection added');
    closeModal();
    state.captureTab = 'sheets';
    renderCapture();
  }

  function editMailStep(stepNum) {
    var step = state.mailConfig.find(function(s){ return s.step_number === stepNum; });
    if (!step) return;
    openModal('<div class="modal-card"><h2>Edit Step ' + stepNum + ': ' + esc(step.label) + '</h2><div class="form-panel">' +
      '<label class="field-label">Subject<input id="ms-subject" value="' + esc(step.subject_template||'') + '" /></label>' +
      '<div style="margin-bottom:6px;font-size:12px;color:var(--muted)">Variables: {{first_name}} {{company}} {{designation}} {{custom_intro}}</div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">' +
        ['{{first_name}}','{{company}}','{{designation}}','{{custom_intro}}'].map(function(v){
          return '<button class="btn btn-sm btn-ghost" onclick="var t=document.getElementById(\'ms-body\');var s=t.selectionStart;t.value=t.value.slice(0,s)+\''+v+'\'+t.value.slice(s);t.focus()">'+v+'</button>';
        }).join('') +
      '</div>' +
      '<label class="field-label">Body<textarea id="ms-body" rows="8">' + esc(step.body_template||'') + '</textarea></label>' +
      '<div class="form-actions"><button class="btn btn-primary" onclick="window.PS2App.saveMailStep(' + stepNum + ')">Save</button><button class="btn btn-ghost" onclick="window.PS2App.closeModal()">Cancel</button></div>' +
    '</div></div>');
  }

  async function saveMailStep(stepNum) {
    var body = {
      step_number: stepNum,
      subject_template: $('ms-subject').value,
      body_template: $('ms-body').value,
    };
    var res = await PS2Api.patchMailConfig(body);
    if (!res.ok) { toast(res.data.error || 'Failed', true); return; }
    toast('Step saved');
    closeModal();
    renderMailConfig();
  }

  async function saveMailConfig() {
    var rows = document.querySelectorAll('.mail-step-row');
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var stepNum = parseInt(row.dataset.step);
      var offset = row.querySelector('.step-offset');
      var active = row.querySelector('.step-active');
      if (!offset && !active) continue;
      await PS2Api.patchMailConfig({
        step_number: stepNum,
        day_offset: parseInt(offset ? offset.value : 0),
        is_active: active ? active.checked : true,
      });
    }
    toast('Mail config saved');
  }

  async function saveSettings() {
    var body = {
      n8n_webhooks: {
        send_email: ($('wh-send-email') || {value:''}).value,
        sync_sheets: ($('wh-sync-sheets') || {value:''}).value,
        process_replies: ($('wh-process-replies') || {value:''}).value,
        enrich_website: ($('wh-enrich-website') || {value:''}).value,
        extract_pdf: ($('wh-extract-pdf') || {value:''}).value,
      },
      ai_prompt_first_email: ($('pt-first-email') || {value:''}).value,
      ai_prompt_reply: ($('pt-reply') || {value:''}).value,
      ai_prompt_sentiment: ($('pt-sentiment') || {value:''}).value,
    };
    var keyEl = $('n8n-api-key');
    if (keyEl && keyEl.value.trim()) body.n8n_api_key = keyEl.value.trim();
    var res = await PS2Api.patchSettings(body);
    if (!res.ok) { toast(res.data.error || 'Failed to save', true); return; }
    toast('Settings saved');
    var msg = $('settings-msg');
    if (msg) { msg.textContent = 'Saved ✓ ' + new Date().toLocaleTimeString(); }
  }

  /* ─────────────────────────────────────────────────────────────────────────
     Lead / Project actions
  ──────────────────────────────────────────────────────────────────────────── */
  async function approveDraft(emailId, leadId) {
    var res = await PS2Api.patchEmail(emailId, { status: 'approved' });
    if (!res.ok) { toast('Failed to approve', true); return; }
    toast('Draft approved — queued for sending');
    renderReviewDrafts();
  }

  async function rejectDraft(emailId, leadId) {
    var res = await PS2Api.patchEmail(emailId, { status: 'rejected' });
    if (!res.ok) { toast('Failed to reject', true); return; }
    toast('Draft rejected');
    renderReviewDrafts();
  }

  function editDraft(emailId) {
    var draft = state.reviewDrafts.find(function(d){ return d.id === emailId; });
    if (!draft) return;
    openModal('<div class="modal-card"><h2>Edit Draft</h2><div class="form-panel">' +
      '<label class="field-label">Subject<input id="ed-subject" value="' + esc(draft.subject||'') + '" /></label>' +
      '<label class="field-label">Body<textarea id="ed-body" rows="8">' + esc(draft.body||'') + '</textarea></label>' +
      '<div class="form-actions">' +
        '<button class="btn btn-primary" onclick="window.PS2App.saveAndApproveDraft(\'' + emailId + '\')">Save & Approve</button>' +
        '<button class="btn btn-ghost" onclick="window.PS2App.closeModal()">Cancel</button>' +
      '</div></div></div>');
  }

  async function saveAndApproveDraft(emailId) {
    var body = { body: $('ed-body').value, subject: $('ed-subject').value, status: 'approved' };
    var res = await PS2Api.patchEmail(emailId, body);
    if (!res.ok) { toast('Failed', true); return; }
    toast('Approved');
    closeModal();
    renderReviewDrafts();
  }

  async function scheduleMeeting(leadId) {
    var lead = state.selectedLead || {};
    var existing = lead.meeting_scheduled_at ? new Date(lead.meeting_scheduled_at) : new Date();
    if (!lead.meeting_scheduled_at) existing.setHours(existing.getHours() + 24, 0, 0, 0);
    existing.setMinutes(existing.getMinutes() - existing.getTimezoneOffset());
    var val = existing.toISOString().slice(0, 16);
    openModal('<div class="modal-card"><h2>Schedule meeting</h2><div class="form-panel">' +
      '<p style="font-size:13px;color:var(--muted);margin:0 0 12px">Use when the prospect agreed to a call or meeting. After it happens, open the lead and choose Convert or Discard.</p>' +
      '<label class="field-label">Date &amp; time (DD/MM style in your browser)' +
        '<input id="mt-when" type="datetime-local" value="' + val + '" required />' +
      '</label>' +
      '<p style="font-size:12px;color:var(--muted);margin:0">Use the calendar picker — shown in your browser’s locale (typically day/month for India).</p>' +
      '<div class="form-actions"><button class="btn btn-primary" onclick="window.PS2App.submitScheduleMeeting(\'' + leadId + '\')">Save meeting</button>' +
      '<button class="btn btn-ghost" onclick="window.PS2App.closeModal()">Cancel</button></div></div></div>');
  }

  async function submitScheduleMeeting(leadId) {
    var raw = $('mt-when') && $('mt-when').value;
    if (!raw) { toast('Pick a date and time', true); return; }
    var res = await PS2Api.patchLead(leadId, { status: 'meeting_scheduled', meeting_scheduled_at: new Date(raw).toISOString() });
    if (!res.ok) { toast('Failed', true); return; }
    toast('Meeting scheduled');
    closeModal();
    closeDetail();
    openLeadDetail(leadId);
  }

  function editLeadWebsite(leadId) {
    var lead = state.selectedLead || {};
    openModal('<div class="modal-card"><h2>Website</h2><div class="form-panel">' +
      '<label class="field-label">URL<input id="lw-url" type="url" placeholder="https://…" value="' + esc(lead.website || '') + '" /></label>' +
      '<div class="form-actions"><button class="btn btn-primary" onclick="window.PS2App.saveLeadWebsite(\'' + leadId + '\')">Save</button>' +
      '<button class="btn btn-ghost" onclick="window.PS2App.closeModal()">Cancel</button></div></div></div>');
  }

  async function saveLeadWebsite(leadId) {
    var website = ($('lw-url') || { value: '' }).value.trim();
    var res = await PS2Api.patchLead(leadId, { website: website || null });
    if (!res.ok) { toast(res.data.error || 'Failed', true); return; }
    toast('Website saved');
    closeModal();
    if (website) {
      await PS2Api.triggerN8n({ workflow: 'enrich_website', payload: { event: 'lead.created', lead_id: leadId, website: website } });
    }
    openLeadDetail(leadId);
  }

  function openLeadUpload(preselectedLeadId) {
    var leads = state.leads || [];
    var leadOpts = leads.map(function(l){
      return '<option value="' + l.id + '"' + (preselectedLeadId === l.id ? ' selected' : '') + '>' +
        esc(l.full_name || l.email || l.id) + (l.company ? ' · ' + esc(l.company) : '') + '</option>';
    }).join('');
    if (preselectedLeadId && !leads.some(function(l){ return l.id === preselectedLeadId; })) {
      leadOpts = '<option value="' + preselectedLeadId + '" selected>Current lead</option>' + leadOpts;
    }
    openModal('<div class="modal-card"><h2>Upload photo / PDF</h2><div class="form-panel">' +
      '<p style="font-size:13px;color:var(--muted);margin:0 0 10px">Attach a business card image or PDF to a lead. OCR via n8n (WF-E) is optional and only runs if configured.</p>' +
      '<label class="field-label">Lead<select id="lu-lead">' + leadOpts + '</select></label>' +
      '<label class="field-label">File<input id="lu-file" type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/*" /></label>' +
      '<label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--muted)">' +
        '<input type="checkbox" id="lu-ocr" /> Request OCR extraction (needs WF-E)</label>' +
      '<div class="form-actions"><button class="btn btn-primary" onclick="window.PS2App.submitLeadUpload()">Upload</button>' +
      '<button class="btn btn-ghost" onclick="window.PS2App.closeModal()">Cancel</button></div></div></div>');
  }

  async function submitLeadUpload() {
    var leadId = ($('lu-lead') || {}).value;
    var fileInput = $('lu-file');
    var file = fileInput && fileInput.files && fileInput.files[0];
    var runOcr = ($('lu-ocr') || {}).checked;
    if (!leadId) { toast('Pick a lead', true); return; }
    if (!file) { toast('Pick a file', true); return; }
    try {
      var b64 = await fileToBase64(file);
      var res = await PS2Api.attachLeadFile({
        lead_id: leadId,
        filename: file.name,
        content_type: file.type || 'application/octet-stream',
        content_base64: b64,
        run_ocr: !!runOcr,
      });
      if (!res.ok) { toast(res.data.error || 'Upload failed', true); return; }
      toast((res.data.data && res.data.data.message) || 'Uploaded');
      closeModal();
      if (document.getElementById('detail-panel')) openLeadDetail(leadId);
      else renderLeads();
    } catch (err) {
      toast('Could not read file', true);
    }
  }

  async function convertLead(leadId) {
    var lead = state.selectedLead || {};
    openModal('<div class="modal-card"><h2>Convert to project</h2><div class="form-panel">' +
      '<p style="font-size:13px;color:var(--muted);margin:0 0 10px">Creates a client tracker card at Enquiry Received. Confirm carefully — this marks the lead as converted.</p>' +
      '<label class="field-label">Client name<input id="cv-client" value="' + esc(lead.company || lead.full_name || '') + '" /></label>' +
      '<label class="field-label">Project name<input id="cv-project" placeholder="e.g. Transformer supply" /></label>' +
      '<label class="field-label">Order value (₹, optional)<input id="cv-value" type="number" /></label>' +
      '<label style="display:flex;align-items:center;gap:8px;font-size:13px;margin:8px 0 4px">' +
        '<input type="checkbox" id="cv-confirm" /> I confirm — convert this lead to a project</label>' +
      '<div class="form-actions"><button class="btn btn-primary" onclick="window.PS2App.submitConvert(\'' + leadId + '\')">Convert</button>' +
      '<button class="btn btn-ghost" onclick="window.PS2App.closeModal()">Cancel</button></div></div></div>');
  }

  async function submitConvert(leadId) {
    if (!($('cv-confirm') || {}).checked) {
      toast('Please confirm conversion before continuing', true);
      return;
    }
    var body = {
      client_name: ($('cv-client') || {value:''}).value.trim() || undefined,
      project_name: ($('cv-project') || {value:''}).value.trim() || undefined,
      order_value: ($('cv-value') || {value:''}).value || undefined,
    };
    var res = await PS2Api.convertLead(leadId, body);
    if (!res.ok) { toast(res.data.error || 'Failed', true); return; }
    var project = res.data.data && res.data.data.project;
    toast(project && project.id
      ? 'Converted → project created. Opening Client Tracker…'
      : 'Converted → project created');
    closeModal();
    closeDetail();
    if (project && project.id) {
      setView('tracker');
      location.hash = 'tracker';
      setTimeout(function(){ openProject(project.id); }, 400);
    } else {
      renderLeads();
    }
  }

  async function discardLead(leadId) {
    if (!confirm('Discard this lead permanently from the active pipeline?\n\nThis cannot be undone from the UI.')) return;
    var res = await PS2Api.patchLead(leadId, { status: 'discarded' });
    if (!res.ok) { toast('Failed', true); return; }
    toast('Lead discarded');
    closeDetail();
    if (state.view === 'pipeline') renderPipeline();
    else renderLeads();
  }

  async function deleteLead(leadId) {
    if (!confirm('Delete this lead forever? Emails and attachments linked to it may also be removed.\n\nOnly sahasra_admin can do this.')) return;
    var res = await PS2Api.deleteLead(leadId);
    if (!res.ok) { toast(res.data.error || 'Delete failed', true); return; }
    toast('Lead deleted');
    closeDetail();
    if (state.view === 'pipeline') renderPipeline();
    else renderLeads();
  }

  async function openLead(id) {
    await openLeadDetail(id);
  }

  async function openProject(id) {
    var res = await PS2Api.getProject(id);
    if (!res.ok) return;
    var p = res.data.data.project;
    var transitions = res.data.data.transitions || [];
    state.selectedProject = p;
    showProjectDetail(p, transitions);
  }

  function showProjectDetail(p, transitions) {
    closeDetail();
    var stages = STAGE_ORDER.slice(0,7);
    var currentIdx = stages.indexOf(p.stage);

    var stepperHtml = '<div class="stage-stepper">';
    stages.forEach(function(s, i){
      stepperHtml += '<div class="stage-step-wrap"><div class="stage-step ' + (i < currentIdx ? 'done' : i === currentIdx ? 'current' : '') + '"><div class="stage-dot">' + (i < currentIdx ? '✓' : i+1) + '</div></div><div class="stage-name" style="max-width:62px;font-size:10px;color:var(--muted);text-align:center">' + esc(STAGE_LABELS[s]||s) + '</div></div>';
      if (i < stages.length - 1) stepperHtml += '<div class="stage-line' + (i < currentIdx ? ' done' : '') + '"></div>';
    });
    stepperHtml += '</div>';

    var nextStages = stages.filter(function(s){ return stages.indexOf(s) > currentIdx; });

    var html =
      '<div class="detail-backdrop" id="detail-backdrop"></div>' +
      '<div class="detail-panel" id="detail-panel">' +
        '<div class="detail-header">' +
          '<div><h2>' + esc(p.project_name) + '</h2>' +
            '<p style="margin:2px 0;color:var(--muted);font-size:13px">' + esc(p.client_name) + ' · ' + stageBadge(p.stage) + (p.order_value ? ' · ' + fmtMoney(p.order_value) : '') + '</p></div>' +
          '<button type="button" class="btn btn-sm btn-ghost" id="btn-close-detail">✕ Close</button>' +
        '</div>' +
        stepperHtml +
        (nextStages.length ? '<div style="margin-bottom:16px"><select id="next-stage" style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px 12px;color:var(--text);font:inherit;margin-right:8px">' +
          nextStages.map(function(s){ return '<option value="'+s+'">'+esc(STAGE_LABELS[s]||s)+'</option>'; }).join('') +
        '</select><input id="advance-notes" placeholder="Notes (optional)" style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px 12px;color:var(--text);font:inherit;width:200px;margin-right:8px" />' +
        '<button class="btn btn-gold btn-sm" onclick="window.PS2App.advanceStage(\'' + p.id + '\')">Advance Stage →</button></div>' : '') +
        '<h3 style="font-size:13px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">Stage History</h3>' +
        (transitions.length === 0 ? '<p style="color:var(--muted);font-size:13px">No transitions yet — project just created.</p>' : '') +
        transitions.map(function(t){
          return '<div style="padding:10px 0;border-bottom:1px solid var(--border);font-size:13px">' +
            '<div style="font-weight:600">' + esc(STAGE_LABELS[t.from_stage]||t.from_stage||'Created') + ' → ' + esc(STAGE_LABELS[t.to_stage]||t.to_stage) + '</div>' +
            (t.notes ? '<div style="color:var(--muted);margin-top:2px">' + esc(t.notes) + '</div>' : '') +
            '<div style="font-size:11px;color:var(--muted);margin-top:3px">' + fmtDate(t.created_at) + '</div>' +
          '</div>';
        }).join('') +
      '</div>';

    document.body.insertAdjacentHTML('beforeend', html);
    $('btn-close-detail').addEventListener('click', function(e){ e.preventDefault(); closeDetail(); });
    $('detail-backdrop').addEventListener('click', closeDetail);
  }

  async function advanceStage(projectId) {
    var toStage = $('next-stage') && $('next-stage').value;
    var notes = $('advance-notes') && $('advance-notes').value;
    if (!toStage) return;
    var res = await PS2Api.advanceProject(projectId, { to_stage: toStage, notes: notes || null });
    if (!res.ok) { toast(res.data.error || 'Failed', true); return; }
    toast('Stage advanced');
    closeDetail();
    openProject(projectId);
  }

  async function deactivateUser(userId) {
    if (!confirm('Deactivate this user?')) return;
    var res = await PS2Api.patchUser(userId, { is_active: false });
    if (!res.ok) { toast('Failed', true); return; }
    toast('User deactivated');
    renderUsers();
  }

  async function toggleSheet(id, active) {
    await PS2Api.patchSheetConnection(id, { is_active: active });
    toast(active ? 'Connection enabled' : 'Connection disabled');
    state.captureTab = 'sheets';
    renderCapture();
  }

  /* ─ Boot ─────────────────────────────────────────────────────────────────── */
  function bindEvents() {
    var form = $('login-form');
    if (form) {
      form.addEventListener('submit', function(e){
        e.preventDefault();
        var fd = new FormData(form);
        login(String(fd.get('username')||'').trim(), String(fd.get('password')||''));
      });
    }
    var signOutBtn = $('btn-signout');
    if (signOutBtn) signOutBtn.addEventListener('click', signOut);

    document.querySelectorAll('.nav-link').forEach(function(a){
      a.addEventListener('click', function(e){
        e.preventDefault();
        var v = a.dataset.view;
        location.hash = v;
        setView(v);
      });
    });
    window.addEventListener('hashchange', function(){
      if (state.user) {
        var v = location.hash.replace(/^#\/?/,'') || 'dashboard';
        setView(v);
      }
    });
  }

  // Expose public API for onclick handlers
  window.PS2App = {
    openAddLead: openAddLead, submitAddLead: submitAddLead,
    openEditLead: openEditLead, submitEditLead: submitEditLead,
    openAddProject: openAddProject, submitAddProject: submitAddProject,
    openAddUser: openAddUser, submitAddUser: submitAddUser,
    openAddSheet: openAddSheet, submitAddSheet: submitAddSheet,
    editMailStep: editMailStep, saveMailStep: saveMailStep, saveMailConfig: saveMailConfig,
    saveSettings: saveSettings,
    closeModal: closeModal,
    approveDraft: approveDraft, rejectDraft: rejectDraft, editDraft: editDraft, saveAndApproveDraft: saveAndApproveDraft,
    scheduleMeeting: scheduleMeeting, submitScheduleMeeting: submitScheduleMeeting,
    convertLead: convertLead, submitConvert: submitConvert, discardLead: discardLead, deleteLead: deleteLead,
    triggerN8n: triggerN8n,
    closeDetail: closeDetail,
    openLeadUpload: openLeadUpload, submitLeadUpload: submitLeadUpload,
    editLeadWebsite: editLeadWebsite, saveLeadWebsite: saveLeadWebsite,
    openLead: openLead, openProject: openProject, advanceStage: advanceStage,
    deactivateUser: deactivateUser, toggleSheet: toggleSheet,
    togglePassword: togglePassword,
  };

  bindEvents();
  bootSession();
})();
