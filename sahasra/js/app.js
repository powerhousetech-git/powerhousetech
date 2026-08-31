(function () {
  'use strict';

  var state = {
    user: null,
    profile: null,
    costings: [],
    costing: null,
    computed: null,
    warnings: [],
    view: 'dashboard',
    wizardStep: 1,
    saving: false,
  };

  var previewTimer = null;

  var STEPS = [
    { n: 1, title: 'Basic info', fields: ['quantity'] },
    {
      n: 2,
      title: 'BOM & material',
      fields: ['bom_cost_elec', 'bom_cost_mech', 'pcb_cost', 'freight_in_pct_override'],
    },
    {
      n: 3,
      title: 'Manufacturing',
      fields: [
        'inventory_carrying_pct_override',
        'labour_mech',
        'functional_ict_testing',
        'programming',
        'lubrication_grease',
        'aoi',
        'pca_labeling',
        'packaging_forwarding',
      ],
      computed: ['inventory_carrying_cost', 'labour_elec'],
    },
    {
      n: 4,
      title: 'PCB details',
      fields: ['smt_pth', 'pcb_vendor', 'pcb_price', 'pcb_size', 'pcb_layer'],
    },
    {
      n: 5,
      title: 'Tooling',
      fields: ['pcb_tooling_override', 'smt_stencil', 'mech_pkg_dev_tooling', 'misc_tooling'],
    },
    {
      n: 6,
      title: 'Lead times',
      fields: ['parts_lead_time', 'production_lead_time', 'engineering_lead_time'],
    },
  ];

  var LABELS = {
    quantity: 'Quantity',
    bom_cost_elec: 'BOM Cost (Amt.) - Elec.',
    bom_cost_mech: 'BOM Cost (Amt.) - Mech.',
    pcb_cost: 'PCB Cost (Amt.)',
    freight_in_pct_override: 'Freight In & CC (%) override',
    inventory_carrying_pct_override: 'Inventory carrying (%) override',
    inventory_carrying_cost: 'Inventory Carrying Cost @ 1%',
    labour_elec: 'Labour Elec.',
    labour_mech: 'Labour Mech.',
    functional_ict_testing: 'Functional & ICT Testing',
    programming: 'Programming',
    lubrication_grease: 'Lubrication grease',
    aoi: 'AOI',
    pca_labeling: 'PCA labeling',
    packaging_forwarding: 'Packaging & Forwarding',
    smt_pth: 'SMT+PTH (component count)',
    pcb_vendor: 'PCB vendor',
    pcb_price: 'PCB Price',
    pcb_size: 'PCB Size (LxW mm)',
    pcb_layer: 'PCB layer',
    pcb_tooling_override: 'PCB Tooling override',
    smt_stencil: 'SMT Stencil',
    mech_pkg_dev_tooling: 'Mech. & Pkg. Dev. Tooling',
    misc_tooling: 'Mic. Tooling',
    parts_lead_time: 'Parts LT',
    production_lead_time: 'Production Lead-Time',
    engineering_lead_time: 'Engineering LT',
    rejection_pct_override: 'Rejection (%) override',
    overhead_pct_override: 'Overhead (%) override',
    freight_out_pct_override: 'Freight Out (%) override',
    margin_pct_override: 'Margin (%) override',
  };

  var PLACEHOLDERS = {
    parts_lead_time: '16-18 weeks',
    production_lead_time: '1 week / Batch',
    engineering_lead_time: '1 week',
    pcb_size: '200x169.4',
    pcb_vendor: 'SCS',
  };

  var COMPUTED_LABELS = {
    inventory_carrying_cost: 'inventory_carrying_cost',
    labour_elec: 'labour_elec',
  };

  function $(id) {
    return document.getElementById(id);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function fmtMoney(n, currency) {
    return SahasraFormat.money(n, currency);
  }

  function toast(msg, isErr) {
    var el = $('toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'toast show' + (isErr ? ' err' : '');
    setTimeout(function () {
      el.className = 'toast';
    }, 3200);
  }

  function show(id) {
    ['gate-view', 'app-shell'].forEach(function (v) {
      var el = $(v);
      if (el) el.classList.toggle('hidden', v !== id);
    });
  }

  function recompute() {
    if (!state.costing || !state.profile) return;
    state.computed = SahasraCompute.computeCosting(state.costing, state.profile.defaults);
    if (state.view === 'review' || state.wizardStep >= 7) {
      state.warnings = SahasraValidation.runValidation(
        state.costing,
        state.computed,
        state.profile.defaults,
      );
    }
  }

  function progressBadge(row) {
    var p = SahasraFormat.progressLabel(row);
    return '<span class="badge badge-' + p.kind + '">' + esc(p.label) + '</span>';
  }

  function statusBadge(row) {
    var st = row.status || 'draft';
    var cls = st === 'draft' ? 'badge-pending' : 'badge-done';
    return '<span class="badge ' + cls + '">' + esc(st.replace(/_/g, ' ')) + '</span>';
  }

  function previewHtml(c, comp) {
    var labourElecText = comp.labour_elec_pending
      ? 'Pending — enter SMT+PTH in Step 4'
      : fmtMoney(comp.labour_elec, c.currency);
    return (
      '<h3>Live preview</h3>' +
      '<div class="preview-row"><span>Inventory carrying</span><strong data-pv="inv">' +
      fmtMoney(comp.inventory_carrying_cost, c.currency) +
      '</strong></div>' +
      '<div class="preview-row"><span>Labour Elec.</span><strong data-pv="labour">' +
      labourElecText +
      '</strong></div>' +
      '<div class="preview-row"><span>Material cost</span><strong data-pv="material">' +
      fmtMoney(comp.material_cost, c.currency) +
      '</strong></div>' +
      '<div class="preview-row"><span>Product cost</span><strong data-pv="product">' +
      fmtMoney(comp.product_cost, c.currency) +
      '</strong></div>' +
      '<div class="preview-row"><span>Quote / unit</span><strong data-pv="quote">' +
      fmtMoney(comp.quote_price_per_unit, c.currency) +
      '</strong></div>' +
      '<div class="preview-row"><span>Value Addition</span><strong data-pv="va">' +
      SahasraFormat.percent(comp.value_addition_pct, 1) +
      '</strong></div>'
    );
  }

  function updatePreviewDom() {
    recompute();
    var c = state.costing;
    var comp = state.computed;
    if (!c || !comp) return;
    var panel = document.querySelector('.preview-panel');
    if (!panel) return;
    var set = function (sel, text) {
      var el = panel.querySelector(sel);
      if (el) el.textContent = text;
    };
    set('[data-pv="inv"]', fmtMoney(comp.inventory_carrying_cost, c.currency));
    set(
      '[data-pv="labour"]',
      comp.labour_elec_pending
        ? 'Pending — enter SMT+PTH in Step 4'
        : fmtMoney(comp.labour_elec, c.currency),
    );
    set('[data-pv="material"]', fmtMoney(comp.material_cost, c.currency));
    set('[data-pv="product"]', fmtMoney(comp.product_cost, c.currency));
    set('[data-pv="quote"]', fmtMoney(comp.quote_price_per_unit, c.currency));
    set('[data-pv="va"]', SahasraFormat.percent(comp.value_addition_pct, 1));

    document.querySelectorAll('[data-computed="labour_elec"]').forEach(function (el) {
      el.textContent = comp.labour_elec_pending
        ? 'Pending — fill SMT+PTH in Step 4'
        : fmtMoney(comp.labour_elec, c.currency);
    });
    document.querySelectorAll('[data-computed="inventory_carrying_cost"]').forEach(function (el) {
      el.textContent = fmtMoney(comp.inventory_carrying_cost, c.currency);
    });
  }

  function schedulePreviewUpdate() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(updatePreviewDom, 80);
  }

  function collectFormFields(form) {
    var patch = {};
    form.querySelectorAll('[data-field]').forEach(function (inp) {
      var key = inp.getAttribute('data-field');
      var v = inp.value.trim();
      if (v === '') patch[key] = null;
      else patch[key] = inp.type === 'number' ? Number(v) : v;
    });
    return patch;
  }

  function applyFormFieldsToState(form) {
    var patch = collectFormFields(form);
    Object.keys(patch).forEach(function (k) {
      state.costing[k] = patch[k];
    });
  }

  async function persistCosting(patch, msg) {
    if (state.saving) return false;
    state.saving = true;
    patch.updated_by = state.profile && state.profile.email;
    patch.status = patch.status || 'draft';
    var res = await SahasraApi.patchCosting(state.costing.id, patch);
    state.saving = false;
    if (!res.ok) {
      toast(res.data.error || 'Save failed', true);
      return false;
    }
    state.costing = res.data.costing;
    recompute();
    if (msg) toast(msg);
    return true;
  }

  function fieldInputHtml(f, c) {
    var val = c[f];
    var isLead = f.indexOf('lead_time') >= 0 || f.indexOf('_lt') >= 0;
    var isText = isLead || f === 'pcb_vendor' || f === 'pcb_size';
    var type = isText ? 'text' : 'number';
    var ph = PLACEHOLDERS[f] ? ' placeholder="' + esc(PLACEHOLDERS[f]) + '"' : '';
    var hint = '';
    if (isLead) {
      hint = '<span class="field-hint">Include units, e.g. weeks or week / Batch</span>';
    }
    return (
      '<label class="field-label">' +
      esc(LABELS[f] || f) +
      '<input data-field="' +
      f +
      '" type="' +
      type +
      '"' +
      (type === 'number' ? ' step="any"' : '') +
      ph +
      ' value="' +
      esc(val != null ? val : '') +
      '" />' +
      hint +
      '</label>'
    );
  }

  function computedFieldHtml(key, c, comp) {
    var text = '';
    if (key === 'labour_elec') {
      text = comp.labour_elec_pending
        ? 'Pending — fill SMT+PTH in Step 4'
        : fmtMoney(comp.labour_elec, c.currency);
    } else if (key === 'inventory_carrying_cost') {
      text = fmtMoney(comp.inventory_carrying_cost, c.currency);
    }
    return (
      '<div class="computed-field">' +
      '<span class="computed-label">' +
      esc(LABELS[key] || key) +
      '</span>' +
      '<span class="computed-value" data-computed="' +
      key +
      '">' +
      esc(text) +
      '</span>' +
      '<span class="field-hint">Auto-calculated · matches Excel formula row</span>' +
      '</div>'
    );
  }

  async function loginWithPassword(username, password) {
    var btn = $('btn-login');
    if (btn) btn.disabled = true;
    try {
      var res = await SahasraApi.login(username, password);
      if (!res.ok) {
        toast(res.data.error || 'Login failed', true);
        return;
      }
      SahasraApi.setToken(res.data.token);
      await enterApp(res.data);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function signOut() {
    SahasraApi.clearToken();
    state.profile = null;
    state.user = null;
    show('gate-view');
  }

  async function enterApp(profile) {
    state.profile = profile;
    show('app-shell');
    $('nav-user-email').textContent = profile.username || profile.email || '';
    $('nav-user-name').textContent = profile.full_name || profile.username || 'User';
    $('nav-org').textContent = (profile.org && profile.org.name) || 'Sahasra Group';
    $('nav-admin-link').classList.toggle('hidden', profile.role !== 'admin');
    routeFromHash();
  }

  async function bootSession() {
    if (!SahasraApi.getToken()) {
      show('gate-view');
      return;
    }
    var res = await SahasraApi.me();
    if (!res.ok) {
      SahasraApi.clearToken();
      show('gate-view');
      if (res.status !== 401) toast(res.data.error || 'Session expired', true);
      return;
    }
    await enterApp(res.data);
  }

  function routeFromHash() {
    var hash = location.hash.replace(/^#\/?/, '') || 'dashboard';
    var parts = hash.split('/');
    state.view = parts[0] || 'dashboard';
    if (state.view === 'costing' && parts[1] === 'new') {
      renderNewCosting();
      return;
    }
    if (state.view === 'costing' && parts[1]) {
      loadCosting(parts[1]);
      return;
    }
    if (state.view === 'costings') {
      loadCostingsList();
      return;
    }
    if (state.view === 'admin') {
      if (state.profile.role !== 'admin') {
        location.hash = '#/dashboard';
        return;
      }
      loadAdminDashboard();
      return;
    }
    loadDashboard();
  }

  function countByProgress(rows) {
    var pending = 0;
    var review = 0;
    var done = 0;
    rows.forEach(function (r) {
      var p = SahasraFormat.progressLabel(r);
      if (p.kind === 'pending') pending++;
      else if (p.kind === 'review') review++;
      else done++;
    });
    return { pending: pending, review: review, done: done };
  }

  async function loadDashboard() {
    setActiveNav('dashboard');
    $('main-title').textContent = 'Dashboard';
    $('main-sub').textContent =
      state.profile && state.profile.role === 'admin'
        ? 'All team costings — who created each entry is shown.'
        : 'Your costings only — other users’ work is private.';
    var res = await SahasraApi.listCostings();
    var rows = res.ok ? res.data.costings || [] : [];
    var counts = countByProgress(rows);
    $('main-content').innerHTML =
      '<div class="kpi-row">' +
      '<div class="kpi"><div class="kpi-label">In progress</div><div class="kpi-val">' +
      counts.pending +
      '</div></div>' +
      '<div class="kpi"><div class="kpi-label">Ready for review</div><div class="kpi-val">' +
      counts.review +
      '</div></div>' +
      '<div class="kpi"><div class="kpi-label">Completed</div><div class="kpi-val">' +
      counts.done +
      '</div></div>' +
      '</div>' +
      '<div class="panel-head"><h2>Recent costings</h2><a class="btn btn-primary btn-sm" href="#/costing/new">+ New costing</a></div>' +
      renderCostingsTable(rows.slice(0, 15));
  }

  async function loadCostingsList() {
    setActiveNav('costings');
    $('main-title').textContent = 'All costings';
    $('main-sub').textContent =
      state.profile && state.profile.role === 'admin'
        ? 'Org-wide list with creator.'
        : 'Only costings you created.';
    var res = await SahasraApi.listCostings();
    state.costings = res.ok ? res.data.costings || [] : [];
    $('main-content').innerHTML =
      '<div class="panel-head"><h2>Costings</h2><a class="btn btn-primary btn-sm" href="#/costing/new">+ New</a></div>' +
      renderCostingsTable(state.costings);
  }

  function renderCostingsTable(rows) {
    if (!rows.length) return '<p class="muted">No costings yet. Create your first one.</p>';
    var isAdmin = state.profile && state.profile.role === 'admin';
    var head =
      '<table class="data-table"><thead><tr><th>Client</th><th>Assembly</th>' +
      (isAdmin ? '<th>Created by</th>' : '') +
      '<th>Progress</th><th>Status</th><th>Updated</th><th></th></tr></thead><tbody>';
    return (
      head +
      rows
        .map(function (r) {
          return (
            '<tr><td>' +
            esc(r.client_name) +
            '</td><td>' +
            esc(r.assembly_name) +
            '</td>' +
            (isAdmin ? '<td>' + esc(r.created_by || '—') + '</td>' : '') +
            '<td>' +
            progressBadge(r) +
            '</td><td>' +
            statusBadge(r) +
            '</td><td>' +
            new Date(r.updated_at).toLocaleString() +
            '</td><td><a href="#/costing/' +
            r.id +
            '">Open</a></td></tr>'
          );
        })
        .join('') +
      '</tbody></table>'
    );
  }

  function renderNewCosting() {
    setActiveNav('costings');
    $('main-title').textContent = 'New costing';
    $('main-sub').textContent = 'Start a guided quotation document.';
    $('main-content').innerHTML =
      '<form id="new-form" class="form-panel">' +
      '<label>Client name<input name="client_name" required placeholder="Client company" /></label>' +
      '<label>Assembly name<input name="assembly_name" required placeholder="Product / assembly" /></label>' +
      '<label>Currency<select name="currency"><option value="USD">USD</option><option value="INR">INR</option></select></label>' +
      '<button type="submit" class="btn btn-primary">Start costing</button></form>';
    $('new-form').onsubmit = async function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      var res = await SahasraApi.createCosting({
        client_name: fd.get('client_name'),
        assembly_name: fd.get('assembly_name'),
        currency: fd.get('currency'),
      });
      if (!res.ok) return toast(res.data.error || 'Create failed', true);
      location.hash = '#/costing/' + res.data.costing.id;
    };
  }

  async function loadCosting(id) {
    setActiveNav('costings');
    var res = await SahasraApi.getCosting(id);
    if (!res.ok) {
      toast(res.data.error || 'Load failed', true);
      location.hash = '#/costings';
      return;
    }
    state.costing = res.data.costing;
    state.wizardStep = state.costing.current_step || 1;
    if (state.wizardStep > 7) state.wizardStep = 7;
    recompute();
    if (state.wizardStep >= 7) renderReview();
    else renderCostingWizard();
  }

  function setActiveNav(view) {
    document.querySelectorAll('[data-nav]').forEach(function (el) {
      el.classList.toggle('active', el.getAttribute('data-nav') === view);
    });
  }

  function bindStepInputs(form) {
    form.querySelectorAll('[data-field]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        applyFormFieldsToState(form);
        schedulePreviewUpdate();
      });
    });
  }

  function costingSubtitle(c, suffix) {
    var parts = [c.client_name];
    if (state.profile && state.profile.role === 'admin' && c.created_by) {
      parts.push('Created by ' + c.created_by);
    }
    if (suffix) parts.push(suffix);
    return parts.join(' · ');
  }

  function renderCostingWizard() {
    var c = state.costing;
    recompute();
    var comp = state.computed;
    $('main-title').textContent = c.assembly_name;
    $('main-sub').textContent = costingSubtitle(
      c,
      c.currency + ' · ' + SahasraFormat.progressLabel(c).label,
    );

    var step = STEPS[state.wizardStep - 1];
    var fieldsHtml = step.fields.map(function (f) {
      return fieldInputHtml(f, c);
    }).join('');

    if (step.computed && step.computed.length) {
      fieldsHtml += step.computed
        .map(function (k) {
          return computedFieldHtml(k, c, comp);
        })
        .join('');
    }

    if (state.wizardStep === 3) {
      fieldsHtml +=
        '<label class="field-label">Labour Elec. override (optional)' +
        '<input data-field="labour_elec_override" type="number" step="any" value="' +
        esc(c.labour_elec_override != null ? c.labour_elec_override : '') +
        '" placeholder="Leave blank to auto-calc from SMT+PTH" /></label>';
    }

    var stepper = STEPS.map(function (s) {
      var done = s.n < state.wizardStep;
      var cur = s.n === state.wizardStep;
      return (
        '<div class="step-item' +
        (done ? ' done' : '') +
        (cur ? ' current' : '') +
        '"><span class="step-num">' +
        s.n +
        '</span> ' +
        esc(s.title) +
        '</div>'
      );
    }).join('');

    $('main-content').innerHTML =
      '<div class="wizard-layout"><aside class="stepper">' +
      stepper +
      '<div class="step-item' +
      (state.wizardStep >= 7 ? ' current' : '') +
      '"><span class="step-num">7</span> Review</div></aside>' +
      '<div class="wizard-main"><h2>Step ' +
      step.n +
      ': ' +
      esc(step.title) +
      '</h2><form id="step-form" class="form-panel">' +
      fieldsHtml +
      '<div class="form-actions">' +
      '<button type="button" class="btn btn-ghost" id="btn-back"' +
      (state.wizardStep <= 1 ? ' disabled' : '') +
      '>Back</button>' +
      '<button type="button" class="btn btn-ghost" id="btn-draft">Save draft</button>' +
      '<button type="submit" class="btn btn-primary">' +
      (state.wizardStep >= 6 ? 'Continue to review' : 'Save & continue') +
      '</button></div></form></div>' +
      '<div class="preview-panel">' +
      previewHtml(c, comp) +
      '</div></div>';

    var form = $('step-form');
    bindStepInputs(form);

    form.onsubmit = async function (e) {
      e.preventDefault();
      var patch = collectFormFields(form);
      var nextStep = state.wizardStep >= 6 ? 7 : state.wizardStep + 1;
      patch.current_step = nextStep;
      patch.status = 'draft';
      var ok = await persistCosting(patch);
      if (!ok) return;
      state.wizardStep = nextStep;
      if (nextStep >= 7) renderReview();
      else renderCostingWizard();
    };

    $('btn-back').onclick = function () {
      if (state.wizardStep <= 1) return;
      state.wizardStep -= 1;
      renderCostingWizard();
    };

    $('btn-draft').onclick = async function () {
      var patch = collectFormFields(form);
      patch.current_step = state.wizardStep;
      patch.status = 'draft';
      await persistCosting(patch, 'Draft saved — you can continue later from the dashboard.');
    };
  }

  function renderReview() {
    state.wizardStep = 7;
    recompute();
    var c = state.costing;
    var comp = state.computed;
    $('main-sub').textContent = costingSubtitle(c, 'Ready for review');

    var rows = [
      ['Material Cost', fmtMoney(comp.material_cost, c.currency)],
      ['Labour Elec.', comp.labour_elec_pending ? 'Pending' : fmtMoney(comp.labour_elec, c.currency)],
      ['Mfg Cost', fmtMoney(comp.mfg_cost, c.currency)],
      ['Product Cost', fmtMoney(comp.product_cost, c.currency)],
      ['Quote Price (per unit)', fmtMoney(comp.quote_price_per_unit, c.currency)],
      ['Order Value', fmtMoney(comp.order_value, c.currency)],
      ['Tooling Cost', fmtMoney(comp.tooling_cost, c.currency)],
      ['Value Addition', SahasraFormat.percent(comp.value_addition_pct, 1)],
      ['Parts LT', c.parts_lead_time || '—'],
      ['Production Lead-Time', c.production_lead_time || '—'],
      ['Engineering LT', c.engineering_lead_time || '—'],
    ];

    var warnHtml = state.warnings.length
      ? '<div class="warn-list">' +
        state.warnings.map(function (w) {
          return '<div class="warn-banner">' + esc(w.message) + '</div>';
        }).join('') +
        '</div>'
      : '<p class="muted">No validation warnings.</p>';

    var overrideFields = [
      'rejection_pct_override',
      'overhead_pct_override',
      'freight_out_pct_override',
      'margin_pct_override',
    ];
    var overrides = overrideFields
      .map(function (f) {
        return (
          '<label>' +
          esc(LABELS[f]) +
          '<input data-override="' +
          f +
          '" type="number" step="any" value="' +
          esc(c[f] != null ? c[f] : '') +
          '" placeholder="Default %" /></label>'
        );
      })
      .join('');

    $('main-content').innerHTML =
      '<div class="review-layout"><div class="review-main"><h2>Review &amp; adjust</h2>' +
      warnHtml +
      '<table class="data-table"><tbody>' +
      rows.map(function (r) {
        return '<tr><td>' + esc(r[0]) + '</td><td><strong>' + esc(r[1]) + '</strong></td></tr>';
      }).join('') +
      '</tbody></table>' +
      '<details class="override-panel"><summary>Override percentages</summary><div class="form-panel">' +
      overrides +
      '<button type="button" class="btn btn-ghost btn-sm" id="save-overrides">Apply overrides</button></div></details>' +
      '<div class="form-actions">' +
      '<button type="button" class="btn btn-ghost" id="btn-edit">Back to edit</button>' +
      '<button type="button" class="btn btn-ghost" id="btn-draft-review">Save draft</button>' +
      '<button type="button" class="btn btn-ghost" id="btn-complete">Mark complete</button>' +
      '<button type="button" class="btn btn-primary" id="btn-export">Export Excel</button>' +
      '</div></div></div>';

    $('btn-edit').onclick = function () {
      state.wizardStep = 6;
      renderCostingWizard();
    };
    $('btn-export').onclick = function () {
      SahasraExport.exportCostingExcel(c, comp);
    };
    $('btn-draft-review').onclick = async function () {
      await persistCosting({ current_step: 7, status: 'draft' }, 'Draft saved at review stage.');
    };
    $('btn-complete').onclick = async function () {
      var ok = await persistCosting({ current_step: 7, status: 'submitted' }, 'Marked complete — visible as submitted on dashboard.');
      if (ok) loadDashboard();
    };
    $('save-overrides').onclick = async function () {
      var patch = { current_step: 7, status: 'draft' };
      document.querySelectorAll('[data-override]').forEach(function (inp) {
        var k = inp.getAttribute('data-override');
        patch[k] = inp.value.trim() === '' ? null : Number(inp.value);
      });
      var ok = await persistCosting(patch);
      if (ok) renderReview();
    };
  }

  async function loadAdminDashboard() {
    setActiveNav('admin');
    $('main-title').textContent = 'Leadership dashboard';
    $('main-sub').textContent = 'Org-wide costing activity (admin).';
    var res = await SahasraApi.dashboard();
    if (!res.ok) {
      $('main-content').innerHTML = '<p class="muted">' + esc(res.data.error) + '</p>';
      return;
    }
    var s = res.data.summary;
    var statusHtml = Object.keys(s.by_status || {})
      .map(function (k) {
        return '<span class="badge">' + esc(k) + ': ' + s.by_status[k] + '</span> ';
      })
      .join('');
    $('main-content').innerHTML =
      '<div class="kpi-row"><div class="kpi"><div class="kpi-label">Total costings</div><div class="kpi-val">' +
      s.total +
      '</div></div></div><p>' +
      statusHtml +
      '</p>' +
      '<div class="panel-head"><h2>Recent costings</h2></div>' +
      '<table class="data-table"><thead><tr><th>Client</th><th>Assembly</th><th>Created by</th><th>Status</th><th>Updated</th><th></th></tr></thead><tbody>' +
      (res.data.recent_costings || [])
        .slice(0, 20)
        .map(function (r) {
          return (
            '<tr><td>' +
            esc(r.client_name) +
            '</td><td>' +
            esc(r.assembly_name) +
            '</td><td>' +
            esc(r.created_by || '—') +
            '</td><td>' +
            esc(r.status) +
            '</td><td>' +
            new Date(r.updated_at).toLocaleString() +
            '</td><td><a href="#/costing/' +
            r.id +
            '">Open</a></td></tr>'
          );
        })
        .join('') +
      '</tbody></table>' +
      '<h3>Recent activity</h3><ul class="activity-list">' +
      (res.data.recent_activity || [])
        .slice(0, 15)
        .map(function (a) {
          return (
            '<li><strong>' +
            esc(a.user_email) +
            '</strong> changed ' +
            esc(a.field_name) +
            ' · ' +
            new Date(a.changed_at).toLocaleString() +
            '</li>'
          );
        })
        .join('') +
      '</ul>';
  }

  function bindEvents() {
    var form = $('login-form');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var fd = new FormData(form);
        loginWithPassword(String(fd.get('username') || '').trim(), String(fd.get('password') || ''));
      });
    }
    var signOutBtn = $('btn-signout');
    if (signOutBtn) signOutBtn.addEventListener('click', signOut);
    window.addEventListener('hashchange', function () {
      if (state.profile) routeFromHash();
    });
  }

  function boot() {
    bindEvents();
    bootSession();
  }

  boot();
})();
