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
    else if (v === 'leads') renderLeads();
    else if (v === 'pipeline') renderPipeline();
    else if (v === 'review-drafts') renderReviewDrafts();
    else if (v === 'tracker') renderTracker();
    else if (v === 'mail-config') renderMailConfig();
    else if (v === 'settings') renderSettings();
    else if (v === 'users') renderUsers();
    else if (v === 'outlook') renderOutlook();
    else if (v === 'sheets') renderSheets();
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

    main.innerHTML =
      '<div class="page-head"><div><h1 class="page-title">Dashboard</h1><p class="page-sub">Pipeline overview — Sahasra Group</p></div></div>' +
      '<div class="kpi-row">' +
        kpi('Total Leads', s.total_leads || 0, '') +
        kpi('Active Outreach', s.sent_leads || 0, 'blue') +
        kpi('Responses', s.responded_leads || 0, 'green') +
        kpi('Meetings', s.meetings_scheduled || 0, 'purple') +
        kpi('Converted', s.converted_leads || 0, 'gold') +
      '</div>' +
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

  function kpi(label, val, colorClass) {
    return '<div class="kpi"><div class="kpi-label">' + esc(label) + '</div><div class="kpi-val ' + colorClass + '">' + val + '</div></div>';
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
      ? '<button class="btn btn-primary btn-sm" onclick="window.PS2App.openAddLead()">+ Add Lead</button>' : '';

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
    var lead = state.leads.find(function(l){ return l.id === id; });
    if (!lead) { var r = await PS2Api.getLead(id); if (!r.ok) return; lead = r.data.data.lead; }
    var emailsRes = await PS2Api.listEmails(id);
    var emails = (emailsRes.ok && emailsRes.data.data) || [];
    state.selectedLead = lead;
    showLeadPanel(lead, emails);
  }

  function showLeadPanel(lead, emails) {
    var existing = document.querySelector('.detail-backdrop');
    if (existing) existing.remove();
    var locked = state.user && state.user.role === 'pt_admin';
    var pendingDraft = emails.find(function(e){ return e.is_ai_draft && e.status === 'pending_review' && e.direction === 'outbound'; });

    var html =
      '<div class="detail-backdrop" id="detail-backdrop"></div>' +
      '<div class="detail-panel" id="detail-panel">' +
        '<div class="detail-header">' +
          '<div><h2>' + esc(lead.full_name || '—') + '</h2><p style="margin:0;color:var(--muted);font-size:13px">' + esc(lead.company || '') + ' · ' + statusBadge(lead.status) + '</p></div>' +
          '<button class="btn btn-sm btn-ghost" onclick="document.getElementById(\'detail-backdrop\').click()">✕ Close</button>' +
        '</div>' +
        (pendingDraft ? draftCard(pendingDraft, lead) : '') +
        '<div class="detail-cols">' +
          detailField('Email', lead.email) +
          detailField('Phone', lead.phone) +
          detailField('Designation', lead.designation) +
          detailField('Source', lead.source) +
          detailField('Tags', (lead.tags||[]).join(', ')) +
          detailField('Meeting', fmtDate(lead.meeting_scheduled_at)) +
        '</div>' +
        (lead.notes ? '<div style="margin-top:14px"><label style="font-size:11px;color:var(--muted);text-transform:uppercase">Notes</label><p style="font-size:13px;margin:4px 0">' + esc(lead.notes) + '</p></div>' : '') +
        (lead.website_summary ? '<div style="margin-top:10px"><label style="font-size:11px;color:var(--muted);text-transform:uppercase">Website Summary</label><p style="font-size:13px;margin:4px 0;color:var(--muted)">' + esc(lead.website_summary) + '</p></div>' : '') +
        (!locked ? '<div style="display:flex;gap:8px;margin-top:18px">' +
          (lead.status !== 'meeting_scheduled' ? '<button class="btn btn-sm" onclick="window.PS2App.scheduleMeeting(\'' + lead.id + '\')">Schedule Meeting</button>' : '') +
          (lead.status !== 'converted' ? '<button class="btn btn-sm btn-primary" onclick="window.PS2App.convertLead(\'' + lead.id + '\')">Mark Converted</button>' : '') +
          (lead.status !== 'discarded' ? '<button class="btn btn-sm btn-danger" onclick="window.PS2App.discardLead(\'' + lead.id + '\')">Discard</button>' : '') +
        '</div>' : '') +
        '<div class="email-timeline" style="margin-top:22px">' +
          '<h3 style="font-size:13px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">Email Timeline</h3>' +
          (emails.length === 0 ? '<p style="color:var(--muted);font-size:13px">No emails yet.</p>' : '') +
          emails.map(function(e){
            var dir = e.direction === 'inbound' ? '← Inbound' : '→ Outbound';
            var dirColor = e.direction === 'inbound' ? 'var(--green)' : 'var(--gold)';
            return '<div class="email-item"><div class="email-meta">' +
              '<span style="color:' + dirColor + ';font-weight:600">' + dir + '</span>' +
              (e.sequence_step ? '<span>Step ' + e.sequence_step + '</span>' : '') +
              sentimentBadge(e.sentiment) +
              '<span class="badge ' + (e.status==='sent'?'badge-green':e.status==='pending_review'?'badge-gold':'badge-gray') + '">' + e.status + '</span>' +
              '<span>' + relTime(e.sent_at || e.received_at || e.created_at) + '</span></div>' +
              '<div class="email-subject">' + esc(e.subject || '(no subject)') + '</div>' +
              '<div class="email-body">' + esc((e.body||'').slice(0,240)) + ((e.body||'').length>240?'…':'') + '</div></div>';
          }).join('') +
        '</div>' +
      '</div>';

    document.body.insertAdjacentHTML('beforeend', html);
    $('detail-backdrop').addEventListener('click', function(){
      document.getElementById('detail-backdrop').remove();
      document.getElementById('detail-panel').remove();
    });
  }

  function draftCard(email, lead) {
    return '<div class="draft-card">' +
      '<h4>🤖 AI Draft — Pending Review</h4>' +
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
      { key:'new', label:'New' }, { key:'mail_1_sent', label:'Mail 1 Sent' },
      { key:'responded', label:'Responded' }, { key:'meeting_scheduled', label:'Meeting' },
      { key:'converted', label:'Converted' }, { key:'discarded', label:'Discarded' },
    ];

    main.innerHTML =
      '<div class="page-head"><div><h1 class="page-title">Pipeline</h1></div></div>' +
      '<div class="tabs"><button class="tab active" onclick="this.parentElement.querySelectorAll(\'.tab\').forEach(t=>t.classList.remove(\'active\')); this.classList.add(\'active\'); document.getElementById(\'pipeline-kanban\').classList.remove(\'hidden\'); document.getElementById(\'pipeline-funnel\').classList.add(\'hidden\')">Kanban</button>' +
      '<button class="tab" onclick="this.parentElement.querySelectorAll(\'.tab\').forEach(t=>t.classList.remove(\'active\')); this.classList.add(\'active\'); document.getElementById(\'pipeline-kanban\').classList.add(\'hidden\'); document.getElementById(\'pipeline-funnel\').classList.remove(\'hidden\')">Funnel</button></div>' +
      '<div id="pipeline-kanban" class="kanban-board">' +
        columns.map(function(col){
          var colLeads = leads.filter(function(l){ return col.key==='mail_1_sent' ? SENT_STATUSES.includes(l.status) : l.status === col.key; });
          return '<div class="kanban-col">' +
            '<div class="kanban-col-head">' + esc(col.label) + '<span style="color:var(--muted)">' + colLeads.length + '</span></div>' +
            '<div class="kanban-col-body">' +
              colLeads.map(function(l){
                return '<div class="kanban-card" onclick="window.PS2App.openLead(\'' + l.id + '\')">' +
                  '<div class="card-name">' + esc(l.full_name || '—') + '</div>' +
                  '<div class="card-company">' + esc(l.company || '') + '</div></div>';
              }).join('') +
              (colLeads.length === 0 ? '<p style="color:var(--muted);font-size:12px;text-align:center;margin:8px 0">Empty</p>' : '') +
            '</div></div>';
        }).join('') +
      '</div>' +
      '<div id="pipeline-funnel" class="hidden"><div class="panel"><div class="panel-head"><h2>Status Funnel</h2></div><div style="padding:20px"><div class="funnel">' +
        columns.map(function(col){
          var count = col.key==='mail_1_sent' ? leads.filter(function(l){return SENT_STATUSES.includes(l.status);}).length : leads.filter(function(l){return l.status===col.key;}).length;
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
      (drafts.length === 0 ? '<div class="panel"><div style="padding:32px;text-align:center;color:var(--muted)">No pending drafts 🎉</div></div>' : '') +
      drafts.map(function(draft){
        var lead = draft.ps2_leads || {};
        return '<div class="review-card">' +
          '<div class="review-card-head">' +
            '<div><h3>' + esc(lead.full_name || lead.company || 'Unknown') + ' — ' + esc(lead.company || '') + '</h3>' +
            '<p style="margin:2px 0;font-size:12px;color:var(--muted)">' + esc(draft.subject || '') + '</p></div>' +
            sentimentBadge(draft.sentiment) +
          '</div>' +
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
      '<div class="page-head"><div><h1 class="page-title">Mail Configuration</h1><p class="page-sub">Email sequence — up to 11 steps</p></div></div>' +
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
        webhookField('Send Email Webhook', 'wh-send-email', s.n8n_webhooks && s.n8n_webhooks.send_email) +
        webhookField('Google Sheets Sync Webhook', 'wh-sync-sheets', s.n8n_webhooks && s.n8n_webhooks.sync_sheets) +
        webhookField('Reply Processing Webhook', 'wh-process-replies', s.n8n_webhooks && s.n8n_webhooks.process_replies) +
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

  function openAddLead() {
    openModal('<div class="modal-card"><h2>Add Lead</h2><div class="form-panel">' +
      '<label class="field-label">Full Name<input id="nl-name" placeholder="Priya Sharma" /></label>' +
      '<label class="field-label">Company<input id="nl-company" placeholder="Acme Corp" /></label>' +
      '<label class="field-label">Email<input id="nl-email" type="email" /></label>' +
      '<label class="field-label">Phone<input id="nl-phone" /></label>' +
      '<label class="field-label">Designation<input id="nl-desig" /></label>' +
      '<label class="field-label">Website<input id="nl-website" type="url" /></label>' +
      '<label class="field-label">Source<select id="nl-source"><option value="manual">Manual</option><option value="business_card">Business Card</option><option value="excel">Excel</option><option value="google_sheet">Google Sheet</option></select></label>' +
      '<label class="field-label">Notes<textarea id="nl-notes"></textarea></label>' +
      '<div class="form-actions"><button class="btn btn-primary" onclick="window.PS2App.submitAddLead()">Save Lead</button><button class="btn btn-ghost" onclick="window.PS2App.closeModal()">Cancel</button></div>' +
    '</div></div>');
  }

  async function submitAddLead() {
    var body = {
      full_name: $('nl-name').value.trim(),
      company: $('nl-company').value.trim(),
      email: $('nl-email').value.trim(),
      phone: $('nl-phone').value.trim(),
      designation: $('nl-desig').value.trim(),
      website: $('nl-website').value.trim(),
      source: $('nl-source').value,
      notes: $('nl-notes').value.trim(),
    };
    if (!body.full_name && !body.email) { toast('Name or email required', true); return; }
    var res = await PS2Api.createLead(body);
    if (!res.ok) { toast(res.data.error || 'Failed to save', true); return; }
    toast('Lead saved');
    closeModal();
    renderLeads();
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
    renderSheets();
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
      },
      ai_prompt_first_email: ($('pt-first-email') || {value:''}).value,
      ai_prompt_reply: ($('pt-reply') || {value:''}).value,
      ai_prompt_sentiment: ($('pt-sentiment') || {value:''}).value,
    };
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
    var d = prompt('Meeting date/time (ISO or readable):');
    if (!d) return;
    var res = await PS2Api.patchLead(leadId, { status: 'meeting_scheduled', meeting_scheduled_at: new Date(d).toISOString() });
    if (!res.ok) { toast('Failed', true); return; }
    toast('Meeting scheduled');
    closeModal();
    renderLeads();
  }

  async function convertLead(leadId) {
    var client = prompt('Client name (or press Enter to use company name):');
    var project = prompt('Project name:');
    if (project === null) return;
    var res = await PS2Api.convertLead(leadId, { client_name: client || undefined, project_name: project || undefined });
    if (!res.ok) { toast(res.data.error || 'Failed', true); return; }
    toast('Converted → project created');
    document.getElementById('detail-backdrop') && document.getElementById('detail-backdrop').click();
    renderLeads();
  }

  async function discardLead(leadId) {
    if (!confirm('Discard this lead?')) return;
    var res = await PS2Api.patchLead(leadId, { status: 'discarded' });
    if (!res.ok) { toast('Failed', true); return; }
    toast('Lead discarded');
    document.getElementById('detail-backdrop') && document.getElementById('detail-backdrop').click();
    renderLeads();
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
    var existing = document.querySelector('.detail-backdrop');
    if (existing) existing.remove();
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
          '<button class="btn btn-sm btn-ghost" onclick="document.getElementById(\'detail-backdrop\').click()">✕ Close</button>' +
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
    $('detail-backdrop').addEventListener('click', function(){
      document.getElementById('detail-backdrop').remove();
      document.getElementById('detail-panel').remove();
    });
  }

  async function advanceStage(projectId) {
    var toStage = $('next-stage') && $('next-stage').value;
    var notes = $('advance-notes') && $('advance-notes').value;
    if (!toStage) return;
    var res = await PS2Api.advanceProject(projectId, { to_stage: toStage, notes: notes || null });
    if (!res.ok) { toast(res.data.error || 'Failed', true); return; }
    toast('Stage advanced');
    var p = res.data.data.project;
    document.getElementById('detail-backdrop') && document.getElementById('detail-backdrop').click();
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
    renderSheets();
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
    openAddProject: openAddProject, submitAddProject: submitAddProject,
    openAddUser: openAddUser, submitAddUser: submitAddUser,
    openAddSheet: openAddSheet, submitAddSheet: submitAddSheet,
    editMailStep: editMailStep, saveMailStep: saveMailStep, saveMailConfig: saveMailConfig,
    saveSettings: saveSettings,
    closeModal: closeModal,
    approveDraft: approveDraft, rejectDraft: rejectDraft, editDraft: editDraft, saveAndApproveDraft: saveAndApproveDraft,
    scheduleMeeting: scheduleMeeting, convertLead: convertLead, discardLead: discardLead,
    openLead: openLead, openProject: openProject, advanceStage: advanceStage,
    deactivateUser: deactivateUser, toggleSheet: toggleSheet,
  };

  bindEvents();
  bootSession();
})();
