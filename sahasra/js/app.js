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
  };

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
    misc_tooling: 'Misc. Tooling',
    parts_lead_time: 'Parts lead time',
    production_lead_time: 'Production lead time',
    engineering_lead_time: 'Engineering lead time',
    rejection_pct_override: 'Rejection (%) override',
    overhead_pct_override: 'Overhead (%) override',
    freight_out_pct_override: 'Freight Out (%) override',
    margin_pct_override: 'Margin (%) override',
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
    ['gate-view', 'denied-view', 'app-shell'].forEach(function (v) {
      var el = $(v);
      if (el) el.classList.toggle('hidden', v !== id);
    });
  }

  function recompute() {
    if (!state.costing || !state.profile) return;
    state.computed = SahasraCompute.computeCosting(state.costing, state.profile.defaults);
    if (state.view === 'review' || state.wizardStep === 7) {
      state.warnings = SahasraValidation.runValidation(
        state.costing,
        state.computed,
        state.profile.defaults,
      );
    }
  }

  async function initFirebase() {
    var fb = window.sahasraFirebase;
    if (fb) return fb;
    var cfg = window.SAHASRA.firebaseConfig;
    var appMod = await import('https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js');
    var authMod = await import('https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js');
    var app = appMod.getApps().length ? appMod.getApps()[0] : appMod.initializeApp(cfg);
    var auth = authMod.getAuth(app);
    await authMod.setPersistence(auth, authMod.browserLocalPersistence).catch(function () {});
    var googleProvider = new authMod.GoogleAuthProvider();
    window.sahasraFirebase = {
      auth: auth,
      googleProvider: googleProvider,
      signInWithPopup: authMod.signInWithPopup,
      signOut: authMod.signOut,
    };
    return window.sahasraFirebase;
  }

  async function signIn() {
    var fb = await initFirebase();
    try {
      await fb.signInWithPopup(fb.auth, fb.googleProvider);
      await bootSession();
    } catch (err) {
      if (err && err.code !== 'auth/popup-closed-by-user') toast(err.message || 'Sign-in failed', true);
    }
  }

  async function signOut() {
    var fb = await initFirebase();
    if (fb.auth.currentUser) await fb.signOut(fb.auth);
    state.profile = null;
    state.user = null;
    show('gate-view');
    renderGate();
  }

  async function bootSession() {
    var fb = await initFirebase();
    var user = fb.auth.currentUser;
    if (!user || !user.email) {
      show('gate-view');
      return;
    }
    state.user = user;
    var res = await SahasraApi.me();
    if (res.status === 403) {
      show('denied-view');
      $('denied-email').textContent = user.email;
<<<<<<< HEAD
=======
      $('denied-view').querySelector('#denied-hint').innerHTML =
        'Only Sahasra-authorized Google accounts can access this portal.<br>Try <strong>shreyassinha.work@gmail.com</strong> or ask your admin to add <strong>' +
        esc(user.email) +
        '</strong>.';
>>>>>>> cursor/sahasra-portal-c344
      return;
    }
    if (!res.ok) {
      show('gate-view');
<<<<<<< HEAD
      toast(res.data.error || 'Could not verify access', true);
=======
      toast((res.data && res.data.error) || 'Could not verify access (HTTP ' + res.status + ')', true);
>>>>>>> cursor/sahasra-portal-c344
      return;
    }
    state.profile = res.data;
    show('app-shell');
    $('nav-user-email').textContent = user.email;
    $('nav-user-name').textContent = state.profile.full_name || user.displayName || user.email.split('@')[0];
    $('nav-org').textContent = (state.profile.org && state.profile.org.name) || 'Sahasra Group';
    $('nav-admin-link').classList.toggle('hidden', state.profile.role !== 'admin');
    routeFromHash();
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

  async function loadDashboard() {
    setActiveNav('dashboard');
    $('main-title').textContent = 'Dashboard';
    $('main-sub').textContent = 'Quotation costing workspace for Sahasra Group.';
    var res = await SahasraApi.listCostings();
    var rows = res.ok ? res.data.costings || [] : [];
    var html =
      '<div class="kpi-row">' +
      '<div class="kpi"><div class="kpi-label">Your costings</div><div class="kpi-val">' +
      rows.length +
      '</div></div>' +
      '<div class="kpi"><div class="kpi-label">Drafts</div><div class="kpi-val">' +
      rows.filter(function (r) {
        return r.status === 'draft';
      }).length +
      '</div></div>' +
      '</div>' +
      '<div class="panel-head"><h2>Recent costings</h2><a class="btn btn-primary btn-sm" href="#/costing/new">+ New costing</a></div>' +
      renderCostingsTable(rows.slice(0, 10));
    $('main-content').innerHTML = html;
  }

  async function loadCostingsList() {
    setActiveNav('costings');
    $('main-title').textContent = 'All costings';
    $('main-sub').textContent = 'History and tracker for quotation documents.';
    var res = await SahasraApi.listCostings();
    state.costings = res.ok ? res.data.costings || [] : [];
    $('main-content').innerHTML =
      '<div class="panel-head"><h2>Costings</h2><a class="btn btn-primary btn-sm" href="#/costing/new">+ New</a></div>' +
      renderCostingsTable(state.costings);
  }

  function renderCostingsTable(rows) {
    if (!rows.length) return '<p class="muted">No costings yet. Create your first one.</p>';
    var th =
      '<table class="data-table"><thead><tr><th>Client</th><th>Assembly</th><th>Status</th><th>Updated</th><th></th></tr></thead><tbody>';
    return (
      th +
      rows
        .map(function (r) {
          return (
            '<tr><td>' +
            esc(r.client_name) +
            '</td><td>' +
            esc(r.assembly_name) +
            '</td><td><span class="badge">' +
            esc(r.status) +
            '</span></td><td>' +
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
    recompute();
    renderCostingWizard();
  }

  function setActiveNav(view) {
    document.querySelectorAll('[data-nav]').forEach(function (el) {
      el.classList.toggle('active', el.getAttribute('data-nav') === view);
    });
  }

  function renderCostingWizard() {
    var c = state.costing;
    var comp = state.computed;
    $('main-title').textContent = c.assembly_name;
    $('main-sub').textContent = c.client_name + ' · ' + c.currency + ' · ' + c.status;

    if (state.wizardStep >= 7) {
      renderReview();
      return;
    }

    var step = STEPS[state.wizardStep - 1];
    var fieldsHtml = step.fields
      .map(function (f) {
        var val = c[f];
        var type = f.indexOf('lead_time') >= 0 || f === 'pcb_vendor' || f === 'pcb_size' ? 'text' : 'number';
        var stepAttr = type === 'number' ? ' step="any"' : '';
        return (
          '<label class="field-label">' +
          esc(LABELS[f] || f) +
          '<input data-field="' +
          f +
          '" type="' +
          type +
          '"' +
          stepAttr +
          ' value="' +
          esc(val != null ? val : '') +
          '" /></label>'
        );
      })
      .join('');

    var preview =
      '<div class="preview-panel"><h3>Live preview</h3>' +
      '<div class="preview-row"><span>Material cost</span><strong>' +
      SahasraExport.money(comp.material_cost, c.currency) +
      '</strong></div>' +
      '<div class="preview-row"><span>Labour Elec.</span><strong>' +
      (comp.labour_elec_pending
        ? 'Pending (needs SMT+PTH)'
        : SahasraExport.money(comp.labour_elec, c.currency)) +
      '</strong></div>' +
      '<div class="preview-row"><span>Product cost</span><strong>' +
      SahasraExport.money(comp.product_cost, c.currency) +
      '</strong></div>' +
      '<div class="preview-row"><span>Quote / unit</span><strong>' +
      SahasraExport.money(comp.quote_price_per_unit, c.currency) +
      '</strong></div></div>';

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
      '<div class="form-actions"><button type="button" class="btn btn-ghost" id="btn-back"' +
      (state.wizardStep <= 1 ? ' disabled' : '') +
      '>Back</button><button type="submit" class="btn btn-primary">' +
      (state.wizardStep >= 6 ? 'Review' : 'Save & continue') +
      '</button></div></form></div>' +
      preview +
      '</div>';

    $('step-form').onsubmit = async function (e) {
      e.preventDefault();
      var patch = {};
      e.target.querySelectorAll('[data-field]').forEach(function (inp) {
        var key = inp.getAttribute('data-field');
        var v = inp.value.trim();
        if (v === '') patch[key] = null;
        else patch[key] = inp.type === 'number' ? Number(v) : v;
      });
      var nextStep = state.wizardStep >= 6 ? 7 : state.wizardStep + 1;
      patch.current_step = nextStep;
      var res = await SahasraApi.patchCosting(c.id, patch);
      if (!res.ok) return toast(res.data.error || 'Save failed', true);
      state.costing = res.data.costing;
      state.wizardStep = nextStep;
      recompute();
      if (nextStep >= 7) renderReview();
      else renderCostingWizard();
    };

    $('btn-back').onclick = function () {
      if (state.wizardStep <= 1) return;
      state.wizardStep -= 1;
      renderCostingWizard();
    };

    var stepForm = $('step-form');
    if (stepForm) {
      stepForm.querySelectorAll('[data-field]').forEach(function (inp) {
        inp.addEventListener('input', function () {
          var key = inp.getAttribute('data-field');
          var v = inp.value.trim();
          state.costing[key] = v === '' ? null : inp.type === 'number' ? Number(v) : v;
          recompute();
          var comp = state.computed;
          document.querySelectorAll('.preview-row strong').forEach(function () {});
          var preview = document.querySelector('.preview-panel');
          if (preview) {
            preview.innerHTML =
              '<h3>Live preview</h3>' +
              '<div class="preview-row"><span>Material cost</span><strong>' +
              SahasraExport.money(comp.material_cost, state.costing.currency) +
              '</strong></div>' +
              '<div class="preview-row"><span>Labour Elec.</span><strong>' +
              (comp.labour_elec_pending
                ? 'Pending (needs SMT+PTH)'
                : SahasraExport.money(comp.labour_elec, state.costing.currency)) +
              '</strong></div>' +
              '<div class="preview-row"><span>Product cost</span><strong>' +
              SahasraExport.money(comp.product_cost, state.costing.currency) +
              '</strong></div>' +
              '<div class="preview-row"><span>Quote / unit</span><strong>' +
              SahasraExport.money(comp.quote_price_per_unit, state.costing.currency) +
              '</strong></div>';
          }
        });
      });
    }
  }

  function renderReview() {
    state.wizardStep = 7;
    recompute();
    var c = state.costing;
    var comp = state.computed;
    var rows = [
      ['Material Cost', comp.material_cost],
      ['Mfg Cost', comp.mfg_cost],
      ['Product Cost', comp.product_cost],
      ['Quote Price (per unit)', comp.quote_price_per_unit],
      ['Order Value', comp.order_value],
      ['Tooling Cost', comp.tooling_cost],
      ['Value Addition', comp.value_addition_pct.toFixed(2) + '%'],
    ];
    var warnHtml = state.warnings.length
      ? '<div class="warn-list">' +
        state.warnings
          .map(function (w) {
            return '<div class="warn-banner">' + esc(w.message) + '</div>';
          })
          .join('') +
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
          '" placeholder="Default" /></label>'
        );
      })
      .join('');

    $('main-content').innerHTML =
      '<div class="review-layout">' +
      '<div class="review-main"><h2>Review &amp; adjust</h2>' +
      warnHtml +
      '<table class="data-table"><tbody>' +
      rows
        .map(function (r) {
          return (
            '<tr><td>' +
            esc(r[0]) +
            '</td><td><strong>' +
            (typeof r[1] === 'number' && r[0].indexOf('%') < 0
              ? SahasraExport.money(r[1], c.currency)
              : esc(r[1])) +
            '</strong></td></tr>'
          );
        })
        .join('') +
      '</tbody></table>' +
      '<details class="override-panel"><summary>Override percentages</summary><div class="form-panel">' +
      overrides +
      '<button type="button" class="btn btn-ghost btn-sm" id="save-overrides">Apply overrides</button></div></details>' +
      '<div class="form-actions">' +
      '<button type="button" class="btn btn-ghost" id="btn-edit">Back to edit</button>' +
      '<button type="button" class="btn btn-primary" id="btn-export">Export Excel</button>' +
      '</div></div></div>';

    $('btn-edit').onclick = function () {
      state.wizardStep = 6;
      renderCostingWizard();
    };
    $('btn-export').onclick = function () {
      SahasraExport.exportCostingExcel(c, comp);
    };
    $('save-overrides').onclick = async function () {
      var patch = { current_step: 7 };
      document.querySelectorAll('[data-override]').forEach(function (inp) {
        var k = inp.getAttribute('data-override');
        patch[k] = inp.value.trim() === '' ? null : Number(inp.value);
      });
      var res = await SahasraApi.patchCosting(c.id, patch);
      if (!res.ok) return toast(res.data.error || 'Save failed', true);
      state.costing = res.data.costing;
      renderReview();
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
      '<div class="kpi-row">' +
      '<div class="kpi"><div class="kpi-label">Total costings</div><div class="kpi-val">' +
      s.total +
      '</div></div></div>' +
      '<p>' +
      statusHtml +
      '</p>' +
      '<h3>Recent activity</h3>' +
      '<ul class="activity-list">' +
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

  function renderGate() {
    $('gate-email-hint').textContent = 'Use your Sahasra-authorized Google account.';
  }

  function bindEvents() {
    $('btn-signin').addEventListener('click', signIn);
    $('btn-signout').addEventListener('click', signOut);
    window.addEventListener('hashchange', function () {
      if (state.profile) routeFromHash();
    });
  }

  async function boot() {
    bindEvents();
    renderGate();
    var fb = await initFirebase();
    return new Promise(function (resolve) {
      import('https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js').then(function (authMod) {
        authMod.onAuthStateChanged(fb.auth, function (user) {
          if (user && user.email) bootSession();
          else show('gate-view');
          resolve();
        });
      });
    });
  }

  boot();
})();
