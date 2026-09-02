(function (global) {
  'use strict';

  function num(v, fallback) {
    var n = Number(v);
    return Number.isFinite(n) ? n : fallback || 0;
  }

  function naList(costing) {
    var list = costing && costing.na_fields;
    return Array.isArray(list) ? list : [];
  }

  function isNaField(costing, field) {
    return naList(costing).indexOf(field) >= 0;
  }

  function fieldNum(costing, field, fallback) {
    if (isNaField(costing, field)) return fallback || 0;
    return num(costing[field], fallback || 0);
  }

  function pct(costing, key, defaults) {
    if (isNaField(costing, key) || isNaField(costing, key + '_override')) {
      return num(defaults[key], 0);
    }
    var override = costing[key + '_override'] ?? costing[key];
    if (override != null && override !== '') return num(override, defaults[key] ?? 0);
    return num(defaults[key], 0);
  }

  function computeCosting(costing, defaults) {
    defaults = defaults || {};
    var quantity = fieldNum(costing, 'quantity', 0);
    var bomElec = fieldNum(costing, 'bom_cost_elec', 0);
    var bomMech = fieldNum(costing, 'bom_cost_mech', 0);
    var pcbCost = fieldNum(costing, 'pcb_cost', 0);
    var smtPth = fieldNum(costing, 'smt_pth', 0);

    var freightInPct = pct(costing, 'freight_in_pct', defaults);
    var inventoryPct = pct(costing, 'inventory_carrying_pct', defaults);
    var rejectionPct = pct(costing, 'rejection_pct', defaults);
    var overheadPct = pct(costing, 'overhead_pct', defaults);
    var freightOutPct = pct(costing, 'freight_out_pct', defaults);
    var marginPct = pct(costing, 'margin_pct', defaults);
    var labourMult = num(defaults.labour_elec_multiplier, 0.005);
    var pcbToolingDefault = num(defaults.pcb_tooling_default, 600);

    var freightInCc = (bomElec + bomMech + pcbCost) * (freightInPct / 100);
    var materialCost = bomElec + bomMech + pcbCost + freightInCc;
    var inventoryCarrying = materialCost * (inventoryPct / 100);

    var labourElec =
      !isNaField(costing, 'labour_elec_override') &&
      costing.labour_elec_override != null &&
      costing.labour_elec_override !== ''
        ? num(costing.labour_elec_override, 0)
        : smtPth * labourMult;

    var labourMech = fieldNum(costing, 'labour_mech', 0);
    var testing = fieldNum(costing, 'functional_ict_testing', 0);
    var programming = fieldNum(costing, 'programming', 0);
    var grease = fieldNum(costing, 'lubrication_grease', 0);
    var aoi = fieldNum(costing, 'aoi', 0);
    var labeling = fieldNum(costing, 'pca_labeling', 0);
    var packaging = fieldNum(costing, 'packaging_forwarding', 0);

    var mfgCost =
      inventoryCarrying +
      labourElec +
      labourMech +
      testing +
      programming +
      grease +
      aoi +
      labeling +
      packaging;

    var subTotal1 = materialCost + mfgCost;
    var rejectionCost = subTotal1 * (rejectionPct / 100);
    var subTotal2 = subTotal1 + rejectionCost;
    var overheads = subTotal2 * (overheadPct / 100);
    var productCost = subTotal2 + overheads;
    var freightOutCc = productCost * (freightOutPct / 100);
    var margin = productCost * (marginPct / 100);
    var quotePrice = productCost + freightOutCc + margin;
    var orderValue = quantity * quotePrice;

    var pcbTooling =
      !isNaField(costing, 'pcb_tooling_override') &&
      costing.pcb_tooling_override != null &&
      costing.pcb_tooling_override !== ''
        ? num(costing.pcb_tooling_override, 0)
        : pcbToolingDefault;
    var smtStencil = fieldNum(costing, 'smt_stencil', 0);
    var mechTooling = fieldNum(costing, 'mech_pkg_dev_tooling', 0);
    var miscTooling = fieldNum(costing, 'misc_tooling', 0);
    var toolingCost = pcbTooling + smtStencil + mechTooling + miscTooling;

    var valueAdditionPct =
      quotePrice > 0 ? ((quotePrice - materialCost) / quotePrice) * 100 : 0;

    return {
      percentages: {
        freight_in_pct: freightInPct,
        inventory_carrying_pct: inventoryPct,
        rejection_pct: rejectionPct,
        overhead_pct: overheadPct,
        freight_out_pct: freightOutPct,
        margin_pct: marginPct,
        labour_elec_multiplier: labourMult,
      },
      freight_in_cc: freightInCc,
      material_cost: materialCost,
      inventory_carrying_cost: inventoryCarrying,
      labour_elec: labourElec,
      labour_elec_pending: smtPth <= 0 && costing.labour_elec_override == null,
      mfg_cost: mfgCost,
      sub_total_1: subTotal1,
      rejection_cost: rejectionCost,
      sub_total_2: subTotal2,
      overheads: overheads,
      product_cost: productCost,
      freight_out_cc: freightOutCc,
      margin: margin,
      quote_price_per_unit: quotePrice,
      order_value: orderValue,
      pcb_tooling: pcbTooling,
      tooling_cost: toolingCost,
      value_addition_pct: valueAdditionPct,
    };
  }

  global.SahasraCompute = {
    computeCosting: computeCosting,
    num: num,
    isNaField: isNaField,
    naList: naList,
    fieldNum: fieldNum,
  };
})(window);
