(function (global) {
  'use strict';

  function runValidation(costing, computed, defaults) {
    var warnings = [];
    function warn(id, field, message) {
      warnings.push({ id: id, field: field, message: message });
    }

    var q = Number(costing.quantity);
    if (!Number.isInteger(q) || q <= 0) warn('V-01', 'quantity', 'Quantity must be a positive integer.');

    ['bom_cost_elec', 'bom_cost_mech', 'pcb_cost', 'labour_mech'].forEach(function (f) {
      if (costing[f] != null && Number(costing[f]) < 0) warn('V-02', f, 'Cost cannot be negative.');
    });

    var layer = Number(costing.pcb_layer);
    if (costing.pcb_layer != null && layer > 0 && layer % 2 !== 0) {
      warn('V-03', 'pcb_layer', 'PCB layer count is usually even (2, 4, 6, 8).');
    }

    if (costing.pcb_size && !/^\s*\d+(\.\d+)?\s*x\s*\d+(\.\d+)?\s*$/i.test(String(costing.pcb_size))) {
      warn('V-04', 'pcb_size', 'PCB size should look like 200x169.4');
    }

    var bomE = Number(costing.bom_cost_elec) || 0;
    var bomM = Number(costing.bom_cost_mech) || 0;
    if (bomE <= 0 && bomM <= 0) warn('V-05', 'bom_cost_elec', 'At least one BOM cost should be greater than zero.');

    if (bomE > 0 && bomM > 0 && bomE < bomM) {
      warn('V-06', 'bom_cost_elec', 'Electronic BOM is lower than mechanical BOM — unusual for EMS assemblies.');
    }

    var va = computed.value_addition_pct;
    if (va > 0 && (va < 15 || va > 60)) {
      warn('V-07', 'value_addition_pct', 'Value addition is ' + va.toFixed(1) + '% (typical band 15–60%).');
    }

    var marginPct = computed.percentages.margin_pct;
    if (marginPct < 5 || marginPct > 25) {
      warn('V-10', 'margin_pct', 'Margin rate is ' + marginPct + '% (typical band 5–25%).');
    }

    if ((Number(costing.smt_pth) || 0) === 0 && bomE > 0) {
      warn('V-11', 'smt_pth', 'SMT+PTH is zero but electronic BOM is set.');
    }

    if ((Number(costing.pcb_cost) || 0) === 0 && layer > 0) {
      warn('V-12', 'pcb_cost', 'PCB layer is set but PCB cost is zero.');
    }

    if (!costing.parts_lead_time || !costing.production_lead_time) {
      warn('V-15', 'parts_lead_time', 'Lead times are incomplete.');
    }

    return warnings;
  }

  global.SahasraValidation = { runValidation: runValidation };
})(window);
