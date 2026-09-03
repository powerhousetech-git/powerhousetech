(function () {
  'use strict';

  var state = {
    user: null,
    profile: null,
    costings: [],
    costing: null,
    computed: null,
    warnings: [],
    view: 'costings',
    wizardStep: 1,
    saving: false,
    expandedId: null,
    charts: [],
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
    freight_in_pct_override: 'Freight In & CC (%)',
    inventory_carrying_pct_override: 'Inventory carrying (%)',
    inventory_carrying_cost: 'Inventory Carrying Cost',
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
    pcb_tooling_override: 'PCB Tooling',
    smt_stencil: 'SMT Stencil',
    mech_pkg_dev_tooling: 'Mech. & Pkg. Dev. Tooling',
    misc_tooling: 'Mic. Tooling',
    parts_lead_time: 'Parts LT',
    production_lead_time: 'Production Lead-Time',
    engineering_lead_time: 'Engineering LT',
    labour_elec_override: 'Labour Elec. (manual)',
    rejection_pct_override: 'Rejection (%)',
    overhead_pct_override: 'Overhead (%)',
    freight_out_pct_override: 'Freight Out (%)',
    margin_pct_override: 'Margin (%)',
  };

  var PLACEHOLDERS = {
    parts_lead_time: '16-18 weeks',
    production_lead_time: '1 week / Batch',
    engineering_lead_time: '1 week',
    pcb_size: '200x169.4',
    pcb_vendor: 'SCS',
  };

  var OVERRIDE_FIELDS = {
    freight_in_pct_override: true,
    inventory_carrying_pct_override: true,
    labour_elec_override: true,
    pcb_tooling_override: true,
    rejection_pct_override: true,
    overhead_pct_override: true,
    freight_out_pct_override: true,
    margin_pct_override: true,
  };

  function defaultPct(key) {
    var d = (state.profile && state.profile.defaults) || {};
    if (key === 'freight_in_pct_override') return d.freight_in_pct != null ? d.freight_in_pct : 5;
    if (key === 'inventory_carrying_pct_override') {
      return d.inventory_carrying_pct != null ? d.inventory_carrying_pct : 1;
    }
    if (key === 'rejection_pct_override') return d.rejection_pct != null ? d.rejection_pct : 1;
    if (key === 'overhead_pct_override') return d.overhead_pct != null ? d.overhead_pct : 3;
    if (key === 'freight_out_pct_override') return d.freight_out_pct != null ? d.freight_out_pct : 5;
    if (key === 'margin_pct_override') return d.margin_pct != null ? d.margin_pct : 10;
    if (key === 'pcb_tooling_override') return d.pcb_tooling_default != null ? d.pcb_tooling_default : 600;
    if (key === 'labour_elec_override') {
      return d.labour_elec_multiplier != null ? d.labour_elec_multiplier : 0.005;
    }
    return '';
  }

  function overrideFormula(key) {
    var d = defaultPct(key);
    if (key === 'freight_in_pct_override') {
      return 'Formula: (BOM Elec + BOM Mech + PCB Cost) × ' + d + '%. Change % if needed.';
    }
    if (key === 'inventory_carrying_pct_override') {
      return 'Formula: Material Cost × ' + d + '%. Change % if needed.';
    }
    if (key === 'labour_elec_override') {
      return 'Formula: SMT+PTH × ' + d + '. Leave blank to auto-calc, or enter a fixed amount.';
    }
    if (key === 'pcb_tooling_override') {
      return 'Default tooling amount: ' + d + '. Leave blank to use default, or enter a new amount.';
    }
    if (key === 'rejection_pct_override') return 'Formula: Sub Total 1 × ' + d + '%.';
    if (key === 'overhead_pct_override') return 'Formula: Sub Total 2 × ' + d + '%.';
    if (key === 'freight_out_pct_override') return 'Formula: Product Cost × ' + d + '%.';
    if (key === 'margin_pct_override') return 'Formula: Product Cost × ' + d + '%.';
    return 'Optional — leave blank to use org default.';
  }

  function getNaFields(costing) {
    return SahasraCompute.naList(costing || state.costing || {});
  }

  function isNaMarked(field, costing) {
    return SahasraCompute.isNaField(costing || state.costing || {}, field);
  }

  function isOverrideField(f) {
    return !!OVERRIDE_FIELDS[f];
  }

  function isFieldSatisfied(field, costing) {
    if (isOverrideField(field)) return true;
    if (isNaMarked(field, costing)) return true;
    var v = costing[field];
    return v != null && String(v).trim() !== '';
  }

  function stepRequiredComplete(step, costing) {
    if (!step || !step.fields) return true;
    return step.fields.every(function (f) {
      return isFieldSatisfied(f, costing);
    });
  }

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
    var st = SahasraFormat.statusLabel(row);
    var cls = 'badge-pending';
    if (st === 'final') cls = 'badge-done';
    else if (st === 'in review') cls = 'badge-review';
    return '<span class="badge ' + cls + '">' + esc(st) + '</span>';
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
    var naFields = getNaFields(state.costing).slice();
    form.querySelectorAll('[data-field]').forEach(function (inp) {
      var key = inp.getAttribute('data-field');
      var naBox = form.querySelector('[data-na="' + key + '"]');
      var markedNa = naBox ? naBox.checked : isNaMarked(key);
      if (markedNa) {
        if (naFields.indexOf(key) < 0) naFields.push(key);
        patch[key] = null;
        return;
      }
      naFields = naFields.filter(function (f) {
        return f !== key;
      });
      var v = inp.value.trim();
      if (v === '') patch[key] = null;
      else patch[key] = inp.type === 'number' ? Number(v) : v;
    });
    // Keep NA marks for fields not on this step.
    patch.na_fields = naFields;
    return patch;
  }

  function applyFormFieldsToState(form) {
    var patch = collectFormFields(form);
    Object.keys(patch).forEach(function (k) {
      state.costing[k] = patch[k];
    });
  }

  function updateContinueGate(form) {
    var btn = form && form.querySelector('#btn-continue');
    if (!btn) return;
    var step = STEPS[state.wizardStep - 1];
    applyFormFieldsToState(form);
    var ok = stepRequiredComplete(step, state.costing);
    btn.disabled = !ok;
    btn.title = ok ? '' : 'Fill all required fields or mark NA to continue';
  }

  async function persistCosting(patch, msg) {
    if (state.saving) return false;
    state.saving = true;
    patch.updated_by =
      (state.profile && (state.profile.username || state.profile.email)) || patch.updated_by;
    patch.status = patch.status || 'draft';
    var res = await SahasraApi.patchCosting(state.costing.id, patch);
    state.saving = false;
    if (!res.ok) {
      toast(res.data.error || 'Save failed', true);
      return false;
    }
    state.costing = res.data.costing;
    if (!Array.isArray(state.costing.na_fields)) state.costing.na_fields = [];
    recompute();
    if (msg) toast(msg);
    return true;
  }

  function fieldInputHtml(f, c) {
    var val = c[f];
    var isLead = f.indexOf('lead_time') >= 0 || f.indexOf('_lt') >= 0;
    var isText = isLead || f === 'pcb_vendor' || f === 'pcb_size';
    var type = isText ? 'text' : 'number';
    var optional = isOverrideField(f);
    var markedNa = !optional && isNaMarked(f, c);
    var ph = '';
    if (optional) {
      ph = ' placeholder="' + esc(String(defaultPct(f))) + '"';
    } else if (PLACEHOLDERS[f]) {
      ph = ' placeholder="' + esc(PLACEHOLDERS[f]) + '"';
    }
    var hint = '';
    if (optional) {
      hint = '<span class="field-hint">' + esc(overrideFormula(f)) + '</span>';
    } else if (isLead) {
      hint = '<span class="field-hint">Include units, e.g. weeks or week / Batch</span>';
    }
    var labelText =
      esc(LABELS[f] || f) +
      (optional
        ? ' <span class="opt-tag">optional</span>'
        : ' <span class="req-star" title="Required">*</span>');
    var naToggle = optional
      ? ''
      : '<label class="na-toggle' +
        (markedNa ? ' is-on' : '') +
        '"><input type="checkbox" data-na="' +
        f +
        '"' +
        (markedNa ? ' checked' : '') +
        ' /><span>NA</span></label>';
    return (
      '<div class="field-row' +
      (markedNa ? ' is-na' : '') +
      (optional ? ' is-optional' : '') +
      '" data-field-row="' +
      f +
      '">' +
      '<div class="field-main">' +
      '<div class="field-top">' +
      '<span class="field-name">' +
      labelText +
      '</span>' +
      naToggle +
      '</div>' +
      '<input data-field="' +
      f +
      '" type="' +
      type +
      '"' +
      (type === 'number' ? ' step="any"' : '') +
      ph +
      (markedNa ? ' disabled' : '') +
      ' value="' +
      esc(markedNa ? '' : val != null ? val : '') +
      '" />' +
      hint +
      '</div></div>'
    );
  }

  function computedFieldHtml(key, c, comp) {
    var text = '';
    var formula = 'Auto-calculated · matches Excel formula row';
    if (key === 'labour_elec') {
      text = comp.labour_elec_pending
        ? 'Pending — fill SMT+PTH in Step 4'
        : fmtMoney(comp.labour_elec, c.currency);
      formula =
        'Formula: SMT+PTH × ' +
        ((state.profile && state.profile.defaults && state.profile.defaults.labour_elec_multiplier) ||
          0.005);
    } else if (key === 'inventory_carrying_cost') {
      text = fmtMoney(comp.inventory_carrying_cost, c.currency);
      formula =
        'Formula: Material Cost × ' +
        (comp.percentages.inventory_carrying_pct != null
          ? comp.percentages.inventory_carrying_pct
          : 1) +
        '%';
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
      '<span class="field-hint">' +
      esc(formula) +
      '</span>' +
      '</div>'
    );
  }

  var PH_ADMIN_GOOGLE_EMAIL = 'shreyassinha.work@gmail.com';

  function waitForFirebase(timeoutMs) {
    return new Promise(function (resolve) {
      if (window.phFirebaseAuth) {
        resolve(window.phFirebaseAuth);
        return;
      }
      var done = false;
      function finish(val) {
        if (done) return;
        done = true;
        window.removeEventListener('ph-firebase-ready', onReady);
        resolve(val);
      }
      function onReady() {
        finish(window.phFirebaseAuth || null);
      }
      window.addEventListener('ph-firebase-ready', onReady);
      setTimeout(function () {
        finish(window.phFirebaseAuth || null);
      }, timeoutMs || 8000);
    });
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

  async function loginWithGoogleAdmin() {
    var btn = $('btn-google-admin');
    if (btn) btn.disabled = true;
    try {
      var fb = await waitForFirebase();
      if (!fb) {
        toast('Google sign-in is unavailable. Try again.', true);
        return;
      }
      var result = await fb.signInWithPopup(fb.auth, fb.googleProvider);
      var email = (result.user && result.user.email ? result.user.email : '').trim().toLowerCase();
      if (email !== PH_ADMIN_GOOGLE_EMAIL) {
        await fb.signOut(fb.auth).catch(function () {});
        SahasraApi.clearToken();
        toast('Use ' + PH_ADMIN_GOOGLE_EMAIL + ' for PowerhouseTech admin access.', true);
        return;
      }
      var idToken = await result.user.getIdToken();
      SahasraApi.setToken(idToken);
      var res = await SahasraApi.me();
      if (!res.ok) {
        await fb.signOut(fb.auth).catch(function () {});
        SahasraApi.clearToken();
        toast(res.data.error || 'Google admin access denied', true);
        return;
      }
      await enterApp(res.data);
    } catch (err) {
      var code = err && err.code;
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        toast((err && err.message) || 'Google sign-in failed', true);
      }
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function signOut() {
    SahasraApi.clearToken();
    state.profile = null;
    state.user = null;
    try {
      var fb = window.phFirebaseAuth;
      if (fb && fb.auth && fb.auth.currentUser) {
        await fb.signOut(fb.auth);
      }
    } catch (_) {}
    show('gate-view');
  }

  async function enterApp(profile) {
    state.profile = profile;
    show('app-shell');
    $('nav-user-email').textContent = profile.email || profile.username || '';
    $('nav-user-name').textContent = profile.full_name || profile.username || 'User';
    $('nav-org').textContent = (profile.org && profile.org.name) || 'Sahasra Group';
    var isAdmin = profile.role === 'admin';
    $('nav-admin-link').classList.toggle('hidden', !isAdmin);
    var hist = $('nav-history-link');
    if (hist) hist.classList.toggle('hidden', !isAdmin);
    if (!location.hash || location.hash === '#/' || location.hash.indexOf('dashboard') >= 0) {
      location.hash = '#/costings';
    }
    await refreshTrueValueBanner();
    routeFromHash();
  }

  async function refreshTrueValueBanner() {
    var banner = $('true-value-banner');
    if (!banner || !state.profile) return;
    var res = await SahasraApi.listCostings();
    var rows = res.ok ? res.data.costings || [] : [];
    var missing = rows.filter(function (r) {
      return SahasraFormat.needsTrueValue(r);
    });
    if (!missing.length) {
      banner.classList.add('hidden');
      banner.innerHTML = '';
      return;
    }
    banner.classList.remove('hidden');
    banner.innerHTML =
      '<strong>' +
      missing.length +
      '</strong> final costing' +
      (missing.length === 1 ? '' : 's') +
      ' need true value after export. ' +
      '<a href="#/costings">Review on Costings</a>';
  }

  async function bootSession() {
    var token = SahasraApi.getToken();
    if (token && token.indexOf('sp1.') === 0) {
      var resPw = await SahasraApi.me();
      if (!resPw.ok) {
        SahasraApi.clearToken();
        show('gate-view');
        if (resPw.status !== 401) toast(resPw.data.error || 'Session expired', true);
        return;
      }
      await enterApp(resPw.data);
      return;
    }

    var fb = await waitForFirebase();
    if (fb && fb.auth) {
      var user = await new Promise(function (resolve) {
        var unsub = fb.onAuthStateChanged(fb.auth, function (u) {
          unsub();
          resolve(u);
        });
      });
      if (user) {
        var email = (user.email || '').trim().toLowerCase();
        if (email !== PH_ADMIN_GOOGLE_EMAIL) {
          await fb.signOut(fb.auth).catch(function () {});
          SahasraApi.clearToken();
          show('gate-view');
          return;
        }
        try {
          SahasraApi.setToken(await user.getIdToken());
          var resG = await SahasraApi.me();
          if (resG.ok) {
            await enterApp(resG.data);
            return;
          }
        } catch (_) {}
        await fb.signOut(fb.auth).catch(function () {});
        SahasraApi.clearToken();
      }
    }

    if (token) {
      var res = await SahasraApi.me();
      if (res.ok) {
        await enterApp(res.data);
        return;
      }
      SahasraApi.clearToken();
    }
    show('gate-view');
  }

  function routeFromHash() {
    var hash = location.hash.replace(/^#\/?/, '') || 'costings';
    var parts = hash.split('/');
    state.view = parts[0] || 'costings';
    if (state.view === 'dashboard') {
      location.hash = '#/costings';
      return;
    }
    if (state.view === 'costing' && parts[1] === 'new') {
      renderNewCosting();
      return;
    }
    if (state.view === 'costing' && parts[1]) {
      loadCosting(parts[1]);
      return;
    }
    if (state.view === 'history') {
      if (!state.profile || state.profile.role !== 'admin') {
        location.hash = '#/costings';
        return;
      }
      loadHistory();
      return;
    }
    if (state.view === 'admin') {
      if (!state.profile || state.profile.role !== 'admin') {
        location.hash = '#/costings';
        return;
      }
      loadAdminDashboard();
      return;
    }
    loadCostingsHome();
  }

  function countByStatus(rows) {
    var draft = 0;
    var inReview = 0;
    var fin = 0;
    var needTrue = 0;
    rows.forEach(function (r) {
      var st = r.status === 'submitted' ? 'final' : r.status;
      if (st === 'draft') draft++;
      else if (st === 'in_review') inReview++;
      else if (st === 'final') {
        fin++;
        if (SahasraFormat.needsTrueValue(r)) needTrue++;
      }
    });
    return { draft: draft, inReview: inReview, fin: fin, needTrue: needTrue };
  }

  function calcSnapshotPatch(comp) {
    return {
      calc_margin: comp.margin,
      calc_quote_price: comp.quote_price_per_unit,
      calc_value_addition: comp.value_addition_pct,
    };
  }

  function confirmDelete(costing) {
    return new Promise(function (resolve) {
      var modal = $('confirm-modal');
      $('confirm-title').textContent = 'Delete costing?';
      $('confirm-body').textContent =
        (costing.client_name || '') + ' / ' + (costing.assembly_name || '') + ' will be removed from the list. This is logged.';
      modal.classList.remove('hidden');
      function cleanup(ok) {
        modal.classList.add('hidden');
        $('confirm-ok').onclick = null;
        $('confirm-cancel').onclick = null;
        resolve(ok);
      }
      $('confirm-ok').onclick = function () {
        cleanup(true);
      };
      $('confirm-cancel').onclick = function () {
        cleanup(false);
      };
    });
  }

  async function deleteCostingRow(id) {
    var row = (state.costings || []).find(function (r) {
      return r.id === id;
    });
    if (!row) return;
    var ok = await confirmDelete(row);
    if (!ok) return;
    var res = await SahasraApi.deleteCosting(id);
    if (!res.ok) {
      toast(res.data.error || 'Delete failed', true);
      return;
    }
    toast('Costing deleted');
    await refreshTrueValueBanner();
    loadCostingsHome();
  }

  function summaryPanelHtml(r) {
    var currency = r.currency || 'USD';
    var calcM = r.calc_margin;
    var calcQ = r.calc_quote_price;
    var calcV = r.calc_value_addition;
    return (
      '<tr class="summary-row" data-summary-for="' +
      r.id +
      '"><td colspan="8"><div class="summary-card">' +
      '<div class="summary-head"><strong>Summary</strong>' +
      (r.flag_count ? ' <span class="badge badge-review">' + r.flag_count + ' flag(s)</span>' : '') +
      '</div>' +
      '<table class="mini-table"><thead><tr><th>Metric</th><th>Calculated</th><th>True value</th></tr></thead><tbody>' +
      '<tr><td>Margin</td><td>' +
      esc(fmtMoney(calcM, currency)) +
      '</td><td>' +
      esc(fmtMoney(r.true_margin, currency)) +
      '</td></tr>' +
      '<tr><td>Quote price</td><td>' +
      esc(fmtMoney(calcQ, currency)) +
      '</td><td>' +
      esc(fmtMoney(r.true_quote_price, currency)) +
      '</td></tr>' +
      '<tr><td>Value addition</td><td>' +
      esc(SahasraFormat.percent(calcV, 1)) +
      '</td><td>' +
      esc(SahasraFormat.percent(r.true_value_addition, 1)) +
      '</td></tr>' +
      '</tbody></table>' +
      '<form class="true-value-form" data-true-form="' +
      r.id +
      '">' +
      '<label>True margin<input name="true_margin" type="number" step="any" value="' +
      esc(r.true_margin != null ? r.true_margin : '') +
      '" /></label>' +
      '<label>True quote price<input name="true_quote_price" type="number" step="any" value="' +
      esc(r.true_quote_price != null ? r.true_quote_price : '') +
      '" /></label>' +
      '<label>True value addition %<input name="true_value_addition" type="number" step="any" value="' +
      esc(r.true_value_addition != null ? r.true_value_addition : '') +
      '" /></label>' +
      '<button type="submit" class="btn btn-primary btn-sm">Save true values</button>' +
      '</form>' +
      commentsBlockHtml(r) +
      '</div></td></tr>'
    );
  }

  function commentsBlockHtml(r) {
    var comments = r.comments || [];
    var list =
      comments.length === 0
        ? '<p class="muted">No admin comments.</p>'
        : '<ul class="activity-list">' +
          comments
            .map(function (c) {
              return (
                '<li>' +
                (c.is_flag ? '<span class="badge badge-review">Flag</span> ' : '') +
                '<strong>' +
                esc(c.author) +
                '</strong>: ' +
                esc(c.body) +
                ' · ' +
                new Date(c.created_at).toLocaleString() +
                '</li>'
              );
            })
            .join('') +
          '</ul>';
    var adminForm = '';
    if (state.profile && state.profile.role === 'admin') {
      adminForm =
        '<form class="flag-form" data-flag-form="' +
        r.id +
        '"><input name="body" placeholder="Flag / comment for PM" required />' +
        '<label class="na-toggle"><input type="checkbox" name="is_flag" checked /><span>Flag error</span></label>' +
        '<button type="submit" class="btn btn-ghost btn-sm">Post</button></form>';
    }
    return '<div class="comments-block"><h4>Feedback</h4>' + list + adminForm + '</div>';
  }

  async function loadCostingsHome() {
    setActiveNav('costings');
    $('main-title').textContent = 'Costings';
    $('main-sub').textContent =
      state.profile && state.profile.role === 'admin'
        ? 'All team costings — who created each entry is shown.'
        : 'Your costings only — other users’ work is private.';
    var res = await SahasraApi.listCostings();
    state.costings = res.ok ? res.data.costings || [] : [];
    var counts = countByStatus(state.costings);
    $('main-content').innerHTML =
      '<div class="kpi-row">' +
      '<div class="kpi"><div class="kpi-label">In progress</div><div class="kpi-val">' +
      counts.draft +
      '</div></div>' +
      '<div class="kpi"><div class="kpi-label">In review</div><div class="kpi-val">' +
      counts.inReview +
      '</div></div>' +
      '<div class="kpi"><div class="kpi-label">Final</div><div class="kpi-val">' +
      counts.fin +
      '</div></div>' +
      '<div class="kpi"><div class="kpi-label">Needs true value</div><div class="kpi-val">' +
      counts.needTrue +
      '</div></div></div>' +
      '<div class="panel-head"><h2>All costings</h2></div>' +
      renderCostingsTable(state.costings);
    bindCostingsTable();
    await refreshTrueValueBanner();
  }

  function renderCostingsTable(rows) {
    if (!rows.length) {
      return '<p class="muted">No costings yet. Use <strong>+ New costing</strong> in the sidebar.</p>';
    }
    var isAdmin = state.profile && state.profile.role === 'admin';
    var head =
      '<table class="data-table costings-table"><thead><tr><th>Client</th><th>Assembly</th>' +
      (isAdmin ? '<th>Created by</th>' : '') +
      '<th>Progress</th><th>Status</th><th>Updated</th><th></th></tr></thead><tbody>';
    var body = rows
      .map(function (r) {
        var st = r.status === 'submitted' ? 'final' : r.status;
        var expanded = state.expandedId === r.id && st === 'final';
        var flagBadge = r.flag_count
          ? '<span class="badge badge-review" title="Admin flags">' + r.flag_count + '</span> '
          : '';
        var row =
          '<tr class="costing-row' +
          (expanded ? ' is-expanded' : '') +
          '" data-id="' +
          r.id +
          '" data-status="' +
          esc(st) +
          '" tabindex="0">' +
          '<td>' +
          flagBadge +
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
          '</td><td class="row-actions">' +
          '<button type="button" class="btn-icon btn-delete" data-delete="' +
          r.id +
          '" title="Delete">🗑</button></td></tr>';
        if (expanded) row += summaryPanelHtml(r);
        return row;
      })
      .join('');
    return head + body + '</tbody></table>';
  }

  function bindCostingsTable() {
    document.querySelectorAll('.costing-row').forEach(function (tr) {
      tr.addEventListener('click', function (e) {
        if (e.target.closest('[data-delete]')) return;
        var id = tr.getAttribute('data-id');
        var st = tr.getAttribute('data-status');
        if (st === 'final') {
          state.expandedId = state.expandedId === id ? null : id;
          loadCostingsHome();
          return;
        }
        location.hash = '#/costing/' + id;
      });
    });
    document.querySelectorAll('[data-delete]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        deleteCostingRow(btn.getAttribute('data-delete'));
      });
    });
    document.querySelectorAll('[data-true-form]').forEach(function (form) {
      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        e.stopPropagation();
        var id = form.getAttribute('data-true-form');
        var fd = new FormData(form);
        var patch = {
          true_margin: fd.get('true_margin') === '' ? null : Number(fd.get('true_margin')),
          true_quote_price:
            fd.get('true_quote_price') === '' ? null : Number(fd.get('true_quote_price')),
          true_value_addition:
            fd.get('true_value_addition') === '' ? null : Number(fd.get('true_value_addition')),
        };
        var res = await SahasraApi.patchCosting(id, patch);
        if (!res.ok) {
          toast(res.data.error || 'Save failed', true);
          return;
        }
        toast('True values saved');
        state.expandedId = id;
        await refreshTrueValueBanner();
        loadCostingsHome();
      });
    });
    document.querySelectorAll('[data-flag-form]').forEach(function (form) {
      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        e.stopPropagation();
        var id = form.getAttribute('data-flag-form');
        var fd = new FormData(form);
        var res = await SahasraApi.addComment(id, String(fd.get('body') || ''), !!fd.get('is_flag'));
        if (!res.ok) {
          toast(res.data.error || 'Could not post', true);
          return;
        }
        toast('Comment posted');
        state.expandedId = id;
        loadCostingsHome();
      });
    });
  }

  function renderNewCosting() {
    setActiveNav('new');
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
    if (!Array.isArray(state.costing.na_fields)) state.costing.na_fields = [];
    var st = state.costing.status === 'submitted' ? 'final' : state.costing.status;
    if (st === 'final') {
      // Final costings open as expandable summary on home, not wizard.
      state.expandedId = id;
      location.hash = '#/costings';
      return;
    }
    state.wizardStep = state.costing.current_step || 1;
    if (state.wizardStep > 7) state.wizardStep = 7;
    recompute();
    if (state.wizardStep >= 7 || st === 'in_review') renderReview();
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
        updateContinueGate(form);
      });
    });
    form.querySelectorAll('[data-na]').forEach(function (box) {
      box.addEventListener('change', function () {
        var key = box.getAttribute('data-na');
        var row = form.querySelector('[data-field-row="' + key + '"]');
        var inp = form.querySelector('[data-field="' + key + '"]');
        if (box.checked) {
          if (inp) {
            inp.value = '';
            inp.disabled = true;
          }
          if (row) row.classList.add('is-na');
          box.closest('.na-toggle').classList.add('is-on');
        } else {
          if (inp) inp.disabled = false;
          if (row) row.classList.remove('is-na');
          box.closest('.na-toggle').classList.remove('is-on');
        }
        applyFormFieldsToState(form);
        schedulePreviewUpdate();
        updateContinueGate(form);
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

  function isCostingLocked() {
    var c = state.costing;
    if (!c) return false;
    var st = c.status === 'submitted' ? 'final' : c.status;
    if (st !== 'final') return false;
    return !(state.profile && state.profile.role === 'admin');
  }

  function renderCostingWizard() {
    if (isCostingLocked()) {
      toast('This costing is final. Only true values can be edited from Costings.', true);
      location.hash = '#/costings';
      return;
    }
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
      fieldsHtml += fieldInputHtml('labour_elec_override', c);
    }

    var stepOk = stepRequiredComplete(step, c);
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
      '</h2><p class="step-req-note">Required fields marked * — use NA if not applicable. Optional % fields show the formula and stay editable.</p><form id="step-form" class="form-panel">' +
      fieldsHtml +
      '<div class="form-actions">' +
      '<button type="button" class="btn btn-ghost" id="btn-back"' +
      (state.wizardStep <= 1 ? ' disabled' : '') +
      '>Back</button>' +
      '<button type="button" class="btn btn-ghost" id="btn-draft">Save draft</button>' +
      '<button type="submit" class="btn btn-primary" id="btn-continue"' +
      (stepOk ? '' : ' disabled') +
      (stepOk ? '' : ' title="Fill all required fields or mark NA to continue"') +
      '>' +
      (state.wizardStep >= 6 ? 'Continue to review' : 'Save & continue') +
      '</button></div></form></div>' +
      '<div class="preview-panel">' +
      previewHtml(c, comp) +
      '</div></div>';

    var form = $('step-form');
    bindStepInputs(form);
    updateContinueGate(form);

    form.onsubmit = async function (e) {
      e.preventDefault();
      applyFormFieldsToState(form);
      if (!stepRequiredComplete(step, state.costing)) {
        toast('Fill all required fields or mark them NA before continuing.', true);
        updateContinueGate(form);
        return;
      }
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
      await persistCosting(patch, 'Draft saved — you can continue later from Costings.');
    };
  }

  function renderReview() {
    state.wizardStep = 7;
    recompute();
    var c = state.costing;
    var comp = state.computed;
    var locked = isCostingLocked();
    $('main-title').textContent = c.assembly_name;
    $('main-sub').textContent = costingSubtitle(c, SahasraFormat.progressLabel(c).label);

    var rows = [
      ['Material Cost', fmtMoney(comp.material_cost, c.currency)],
      ['Labour Elec.', comp.labour_elec_pending ? 'Pending' : fmtMoney(comp.labour_elec, c.currency)],
      ['Mfg Cost', fmtMoney(comp.mfg_cost, c.currency)],
      ['Product Cost', fmtMoney(comp.product_cost, c.currency)],
      ['Quote Price (per unit)', fmtMoney(comp.quote_price_per_unit, c.currency)],
      ['Order Value', fmtMoney(comp.order_value, c.currency)],
      ['Tooling Cost', fmtMoney(comp.tooling_cost, c.currency)],
      ['Margin', fmtMoney(comp.margin, c.currency)],
      ['Value Addition', SahasraFormat.percent(comp.value_addition_pct, 1)],
      ['Parts LT', c.parts_lead_time || '—'],
      ['Production Lead-Time', c.production_lead_time || '—'],
      ['Engineering LT', c.engineering_lead_time || '—'],
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
          '<div class="field-row is-optional"><div class="field-main"><div class="field-top"><span class="field-name">' +
          esc(LABELS[f]) +
          ' <span class="opt-tag">optional</span></span></div>' +
          '<input data-override="' +
          f +
          '" type="number" step="any" value="' +
          esc(c[f] != null ? c[f] : '') +
          '" placeholder="' +
          esc(String(defaultPct(f))) +
          '" />' +
          '<span class="field-hint">' +
          esc(overrideFormula(f)) +
          '</span></div></div>'
        );
      })
      .join('');

    var adminReopen =
      state.profile && state.profile.role === 'admin' && (c.status === 'final' || c.status === 'submitted')
        ? '<button type="button" class="btn btn-ghost" id="btn-reopen">Reopen to review</button>'
        : '';

    $('main-content').innerHTML =
      '<div class="review-layout"><div class="review-main"><h2>Review &amp; adjust</h2>' +
      warnHtml +
      '<table class="data-table"><tbody>' +
      rows
        .map(function (r) {
          return '<tr><td>' + esc(r[0]) + '</td><td><strong>' + esc(r[1]) + '</strong></td></tr>';
        })
        .join('') +
      '</tbody></table>' +
      (locked
        ? ''
        : '<details class="override-panel" open><summary>Percentage formulas (editable)</summary><div class="form-panel">' +
          overrides +
          '<button type="button" class="btn btn-ghost btn-sm" id="save-overrides">Apply overrides</button></div></details>') +
      '<div class="form-actions">' +
      '<button type="button" class="btn btn-ghost" id="btn-edit"' +
      (locked ? ' disabled' : '') +
      '>Back to edit</button>' +
      '<button type="button" class="btn btn-ghost" id="btn-draft-review"' +
      (locked ? ' disabled' : '') +
      '>Save draft</button>' +
      '<button type="button" class="btn btn-ghost" id="btn-submit-review"' +
      (locked ? ' disabled' : '') +
      '>Submit for review</button>' +
      '<button type="button" class="btn btn-primary" id="btn-export">Export Excel &amp; mark final</button>' +
      adminReopen +
      '</div></div></div>';

    $('btn-edit').onclick = function () {
      if (locked) return;
      state.wizardStep = 6;
      renderCostingWizard();
    };
    $('btn-export').onclick = async function () {
      recompute();
      var snap = calcSnapshotPatch(state.computed);
      snap.status = 'final';
      snap.current_step = 7;
      snap.exported_at = new Date().toISOString();
      var ok = await persistCosting(snap, 'Exported and marked final.');
      if (!ok) return;
      SahasraExport.exportCostingExcel(state.costing, state.computed);
      state.expandedId = state.costing.id;
      await refreshTrueValueBanner();
      location.hash = '#/costings';
    };
    $('btn-draft-review').onclick = async function () {
      if (locked) return;
      await persistCosting({ current_step: 7, status: 'draft' }, 'Draft saved at review stage.');
    };
    $('btn-submit-review').onclick = async function () {
      if (locked) return;
      var snap = calcSnapshotPatch(comp);
      snap.current_step = 7;
      snap.status = 'in_review';
      var ok = await persistCosting(snap, 'Submitted for review.');
      if (ok) location.hash = '#/costings';
    };
    var reopen = $('btn-reopen');
    if (reopen) {
      reopen.onclick = async function () {
        var ok = await persistCosting({ status: 'in_review', current_step: 7 }, 'Reopened for review.');
        if (ok) renderReview();
      };
    }
    var saveOv = $('save-overrides');
    if (saveOv) {
      saveOv.onclick = async function () {
        var patch = { current_step: 7, status: c.status === 'in_review' ? 'in_review' : 'draft' };
        document.querySelectorAll('[data-override]').forEach(function (inp) {
          var k = inp.getAttribute('data-override');
          patch[k] = inp.value.trim() === '' ? null : Number(inp.value);
        });
        var ok = await persistCosting(patch);
        if (ok) renderReview();
      };
    }
  }

  function destroyCharts() {
    (state.charts || []).forEach(function (ch) {
      try {
        ch.destroy();
      } catch (_) {}
    });
    state.charts = [];
  }

  function buildLineChart(canvasId, labels, calcData, trueData, labelCalc, labelTrue) {
    if (typeof Chart === 'undefined') return;
    var ctx = document.getElementById(canvasId);
    if (!ctx) return;
    var ch = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: labelCalc,
            data: calcData,
            borderColor: '#e87a2e',
            backgroundColor: 'transparent',
            tension: 0.25,
          },
          {
            label: labelTrue,
            data: trueData,
            borderColor: '#2ea86a',
            backgroundColor: 'transparent',
            tension: 0.25,
            borderDash: [4, 4],
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { labels: { color: '#c8cdd8' } } },
        scales: {
          x: { ticks: { color: '#8b93a7' }, grid: { color: 'rgba(255,255,255,0.06)' } },
          y: { ticks: { color: '#8b93a7' }, grid: { color: 'rgba(255,255,255,0.06)' } },
        },
      },
    });
    state.charts.push(ch);
  }

  async function loadAdminDashboard() {
    setActiveNav('admin');
    destroyCharts();
    $('main-title').textContent = 'Leadership';
    $('main-sub').textContent = 'Org-wide calc vs true values, per-PM trends, and flags.';
    var res = await SahasraApi.dashboard();
    if (!res.ok) {
      $('main-content').innerHTML = '<p class="muted">' + esc(res.data.error) + '</p>';
      return;
    }
    var s = res.data.summary;
    var chartRows = (res.data.chart_rows || []).slice().reverse();
    var labels = chartRows.map(function (r, i) {
      return (r.assembly_name || r.client_name || '#' + (i + 1)).slice(0, 16);
    });
    var statusHtml = Object.keys(s.by_status || {})
      .map(function (k) {
        return '<span class="badge">' + esc(k) + ': ' + s.by_status[k] + '</span> ';
      })
      .join('');

    var byPm = s.by_creator || {};
    var pmHtml = Object.keys(byPm)
      .map(function (k) {
        return '<div class="kpi"><div class="kpi-label">' + esc(k) + '</div><div class="kpi-val">' + byPm[k] + '</div></div>';
      })
      .join('');

    $('main-content').innerHTML =
      '<div class="kpi-row"><div class="kpi"><div class="kpi-label">Total costings</div><div class="kpi-val">' +
      s.total +
      '</div></div></div><p>' +
      statusHtml +
      '</p>' +
      '<h3>By project manager</h3><div class="kpi-row">' +
      (pmHtml || '<p class="muted">No data</p>') +
      '</div>' +
      '<div class="charts-grid">' +
      '<div class="chart-card"><h4>Margins (calc vs true)</h4><canvas id="chart-margin" height="160"></canvas></div>' +
      '<div class="chart-card"><h4>Quote price (calc vs true)</h4><canvas id="chart-quote" height="160"></canvas></div>' +
      '<div class="chart-card"><h4>Value addition % (calc vs true)</h4><canvas id="chart-va" height="160"></canvas></div>' +
      '</div>' +
      '<h3>Per project manager — quote calc vs true</h3><div class="charts-grid" id="pm-charts"></div>' +
      '<div class="panel-head"><h2>Recent costings</h2></div>' +
      renderLeadershipTable(res.data.recent_costings || []) +
      '<h3>Recent activity</h3><ul class="activity-list">' +
      (res.data.recent_activity || [])
        .slice(0, 20)
        .map(function (a) {
          return (
            '<li><strong>' +
            esc(a.user_email) +
            '</strong> ' +
            esc(a.field_name) +
            ' · ' +
            new Date(a.changed_at).toLocaleString() +
            '</li>'
          );
        })
        .join('') +
      '</ul>';

    buildLineChart(
      'chart-margin',
      labels,
      chartRows.map(function (r) {
        return r.calc_margin;
      }),
      chartRows.map(function (r) {
        return r.true_margin;
      }),
      'Calculated',
      'True',
    );
    buildLineChart(
      'chart-quote',
      labels,
      chartRows.map(function (r) {
        return r.calc_quote_price;
      }),
      chartRows.map(function (r) {
        return r.true_quote_price;
      }),
      'Calculated',
      'True',
    );
    buildLineChart(
      'chart-va',
      labels,
      chartRows.map(function (r) {
        return r.calc_value_addition;
      }),
      chartRows.map(function (r) {
        return r.true_value_addition;
      }),
      'Calculated',
      'True',
    );

    var pmCharts = $('pm-charts');
    if (pmCharts) {
      var pms = Object.keys(byPm);
      pmCharts.innerHTML = pms
        .map(function (pm, idx) {
          return (
            '<div class="chart-card"><h4>' +
            esc(pm) +
            '</h4><canvas id="chart-pm-' +
            idx +
            '" height="140"></canvas></div>'
          );
        })
        .join('') || '<p class="muted">No PM data yet.</p>';
      pms.forEach(function (pm, idx) {
        var subset = chartRows.filter(function (r) {
          return r.created_by === pm;
        });
        var plabels = subset.map(function (r, i) {
          return (r.assembly_name || '#' + (i + 1)).slice(0, 14);
        });
        buildLineChart(
          'chart-pm-' + idx,
          plabels,
          subset.map(function (r) {
            return r.calc_quote_price;
          }),
          subset.map(function (r) {
            return r.true_quote_price;
          }),
          'Calculated',
          'True',
        );
      });
    }
    bindLeadershipTable();
  }

  function renderLeadershipTable(rows) {
    if (!rows.length) return '<p class="muted">No costings yet.</p>';
    return (
      '<table class="data-table costings-table"><thead><tr><th>Client</th><th>Assembly</th><th>Created by</th><th>Status</th><th>Deviation</th><th>Updated</th></tr></thead><tbody>' +
      rows
        .map(function (r) {
          var st = r.status === 'submitted' ? 'final' : r.status;
          var expanded = state.expandedId === r.id;
          var dev = '—';
          if (r.calc_quote_price != null && r.true_quote_price != null && Number(r.calc_quote_price)) {
            var d = ((Number(r.true_quote_price) - Number(r.calc_quote_price)) / Number(r.calc_quote_price)) * 100;
            dev = (d >= 0 ? '+' : '') + d.toFixed(1) + '% quote';
          }
          var row =
            '<tr class="costing-row leadership-row' +
            (expanded ? ' is-expanded' : '') +
            '" data-id="' +
            r.id +
            '" tabindex="0"><td>' +
            esc(r.client_name) +
            '</td><td>' +
            esc(r.assembly_name) +
            '</td><td>' +
            esc(r.created_by || '—') +
            '</td><td>' +
            statusBadge(r) +
            (r.flag_count ? ' <span class="badge badge-review">' + r.flag_count + '</span>' : '') +
            '</td><td>' +
            esc(dev) +
            '</td><td>' +
            new Date(r.updated_at).toLocaleString() +
            '</td></tr>';
          if (expanded) row += summaryPanelHtml(r);
          return row;
        })
        .join('') +
      '</tbody></table>'
    );
  }

  function bindLeadershipTable() {
    document.querySelectorAll('.leadership-row').forEach(function (tr) {
      tr.addEventListener('click', function () {
        var id = tr.getAttribute('data-id');
        state.expandedId = state.expandedId === id ? null : id;
        loadAdminDashboard();
      });
    });
    document.querySelectorAll('[data-true-form]').forEach(function (form) {
      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        e.stopPropagation();
        var id = form.getAttribute('data-true-form');
        var fd = new FormData(form);
        var patch = {
          true_margin: fd.get('true_margin') === '' ? null : Number(fd.get('true_margin')),
          true_quote_price:
            fd.get('true_quote_price') === '' ? null : Number(fd.get('true_quote_price')),
          true_value_addition:
            fd.get('true_value_addition') === '' ? null : Number(fd.get('true_value_addition')),
        };
        var res = await SahasraApi.patchCosting(id, patch);
        if (!res.ok) return toast(res.data.error || 'Save failed', true);
        toast('True values saved');
        state.expandedId = id;
        loadAdminDashboard();
      });
    });
    document.querySelectorAll('[data-flag-form]').forEach(function (form) {
      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        e.stopPropagation();
        var id = form.getAttribute('data-flag-form');
        var fd = new FormData(form);
        var res = await SahasraApi.addComment(id, String(fd.get('body') || ''), !!fd.get('is_flag'));
        if (!res.ok) return toast(res.data.error || 'Could not post', true);
        toast('Flag posted');
        state.expandedId = id;
        loadAdminDashboard();
      });
    });
  }

  async function loadHistory() {
    setActiveNav('history');
    destroyCharts();
    $('main-title').textContent = 'History logs';
    $('main-sub').textContent = 'Field changes, deletes, and flags across Sahasra costings.';
    var res = await SahasraApi.history();
    if (!res.ok) {
      $('main-content').innerHTML = '<p class="muted">' + esc(res.data.error) + '</p>';
      return;
    }
    var rows = res.data.activity || [];
    $('main-content').innerHTML =
      '<ul class="activity-list history-list">' +
      (rows.length
        ? rows
            .map(function (a) {
              return (
                '<li><strong>' +
                esc(a.user_email) +
                '</strong> · ' +
                esc(a.field_name) +
                (a.old_value != null ? ' from ' + esc(String(a.old_value).slice(0, 40)) : '') +
                (a.new_value != null ? ' → ' + esc(String(a.new_value).slice(0, 60)) : '') +
                ' <span class="muted">· ' +
                new Date(a.changed_at).toLocaleString() +
                '</span></li>'
              );
            })
            .join('')
        : '<li class="muted">No activity yet.</li>') +
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
    var googleBtn = $('btn-google-admin');
    if (googleBtn) googleBtn.addEventListener('click', loginWithGoogleAdmin);
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
