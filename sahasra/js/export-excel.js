(function (global) {
  'use strict';

  var FORMULA_FILL = { patternType: 'solid', fgColor: { rgb: 'FFF2CC' } };
  var ALIGN_LEFT = { horizontal: 'left', vertical: 'center' };
  var ALIGN_RIGHT = { horizontal: 'right', vertical: 'center' };

  function isNaField(costing, field) {
    if (global.SahasraCompute && global.SahasraCompute.isNaField) {
      return global.SahasraCompute.isNaField(costing, field);
    }
    var list = costing && costing.na_fields;
    return Array.isArray(list) && list.indexOf(field) >= 0;
  }

  /** Truncate toward zero to 2 decimal places (1.239 → 1.23). */
  function trunc2(n) {
    var x = Number(n);
    if (!Number.isFinite(x)) return n;
    var sign = x < 0 ? -1 : 1;
    return (sign * Math.floor(Math.abs(x) * 100 + 1e-8)) / 100;
  }

  function numericCell(value) {
    if (value == null || value === '') return '';
    if (typeof value === 'number') return trunc2(value);
    if (typeof value === 'string' && value !== 'NA' && value.trim() !== '' && Number.isFinite(Number(value))) {
      return trunc2(Number(value));
    }
    return value;
  }

  function cell(costing, field, fallback) {
    if (isNaField(costing, field)) return 'NA';
    if (costing[field] == null || costing[field] === '') {
      return fallback != null ? numericCell(fallback) : '';
    }
    return numericCell(costing[field]);
  }

  function row(label, value, opts) {
    opts = opts || {};
    return {
      label: label,
      value: value,
      formula: !!opts.formula,
      percent: !!opts.percent,
    };
  }

  function buildRows(costing, computed) {
    var pct = (computed && computed.percentages) || {};
    var vaPct = computed && computed.value_addition_pct != null ? trunc2(computed.value_addition_pct) : 0;
    return [
      row('Assembly Name', costing.assembly_name || ''),
      row('', ''),
      row('Quantity', cell(costing, 'quantity')),
      row('BOM Cost(Amt.)-Elec.', cell(costing, 'bom_cost_elec')),
      row('BOM Cost(Amt.)-Mech.', cell(costing, 'bom_cost_mech')),
      row('PCB Cost(Amt.)', cell(costing, 'pcb_cost')),
      row(
        'Freight In & CC @ ' + (pct.freight_in_pct != null ? pct.freight_in_pct : 5) + '%',
        numericCell(computed.freight_in_cc),
        { formula: true }
      ),
      row('Material Cost', numericCell(computed.material_cost), { formula: true }),
      row(
        'Inventory Carrying Cost @ ' +
          (pct.inventory_carrying_pct != null ? pct.inventory_carrying_pct : 1) +
          '%',
        numericCell(computed.inventory_carrying_cost),
        { formula: true }
      ),
      row('Labour Elec.', numericCell(computed.labour_elec), { formula: true }),
      row('Labour Mech.', cell(costing, 'labour_mech')),
      row('Functional & ICT Testing', cell(costing, 'functional_ict_testing')),
      row('Programming', cell(costing, 'programming', 0)),
      row('lubrication grease', cell(costing, 'lubrication_grease')),
      row('AOI', cell(costing, 'aoi')),
      row('PCA labeling', cell(costing, 'pca_labeling')),
      row('Packaging & Forwarding', cell(costing, 'packaging_forwarding')),
      row('Mfg Cost', numericCell(computed.mfg_cost), { formula: true }),
      row('Sub Total 1', numericCell(computed.sub_total_1), { formula: true }),
      row(
        'Rejection Cost @ ' + (pct.rejection_pct != null ? pct.rejection_pct : 1) + '%',
        numericCell(computed.rejection_cost),
        { formula: true }
      ),
      row('Sub Total 2', numericCell(computed.sub_total_2), { formula: true }),
      row(
        'Overheads @ ' + (pct.overhead_pct != null ? pct.overhead_pct : 3) + '%',
        numericCell(computed.overheads),
        { formula: true }
      ),
      row('Product Cost', numericCell(computed.product_cost), { formula: true }),
      row(
        'Freight Out & CC @ ' + (pct.freight_out_pct != null ? pct.freight_out_pct : 5) + '%',
        numericCell(computed.freight_out_cc),
        { formula: true }
      ),
      row(
        'Margin @ ' + (pct.margin_pct != null ? pct.margin_pct : 10) + '%',
        numericCell(computed.margin),
        { formula: true }
      ),
      row('Quote Price (per unit) USD', numericCell(computed.quote_price_per_unit), { formula: true }),
      row('Order Value', numericCell(computed.order_value), { formula: true }),
      row('Tooling Cost-USD', numericCell(computed.tooling_cost), { formula: true }),
      row('Stencils ', ''),
      row('SMT+PTH', cell(costing, 'smt_pth')),
      row('PCB vendor', cell(costing, 'pcb_vendor')),
      row('PCB Price', cell(costing, 'pcb_price')),
      row('PCB Size', cell(costing, 'pcb_size')),
      row('PCB layer', cell(costing, 'pcb_layer')),
      row(
        'PCB ',
        isNaField(costing, 'pcb_tooling_override') ? 'NA' : numericCell(computed.pcb_tooling),
        { formula: true }
      ),
      row('SMT Stencil', cell(costing, 'smt_stencil')),
      row('Mech. and Pkg. Development Tooling', cell(costing, 'mech_pkg_dev_tooling')),
      row('Mic. Tooling', cell(costing, 'misc_tooling')),
      row('Parts LT', cell(costing, 'parts_lead_time')),
      row('Production Lead-Time', cell(costing, 'production_lead_time')),
      row('Engineering LT', cell(costing, 'engineering_lead_time')),
      row('Value Addition', vaPct / 100, { formula: true, percent: true }),
    ];
  }

  function styleForCell(col, meta, value) {
    var s = {
      alignment: col === 0 ? ALIGN_LEFT : ALIGN_RIGHT,
    };
    if (meta.formula) {
      s.fill = FORMULA_FILL;
    }
    if (col === 1 && typeof value === 'number') {
      s.numFmt = meta.percent ? '0.00%' : '0.00';
    }
    return s;
  }

  function buildWorksheet(costing, computed) {
    var metaRows = buildRows(costing, computed);
    var aoa = metaRows.map(function (r) {
      return [r.label, r.value];
    });
    var ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 42 }, { wch: 18 }];

    for (var i = 0; i < metaRows.length; i++) {
      var meta = metaRows[i];
      var aRef = XLSX.utils.encode_cell({ r: i, c: 0 });
      var bRef = XLSX.utils.encode_cell({ r: i, c: 1 });
      if (!ws[aRef]) ws[aRef] = { t: 's', v: meta.label || '' };
      if (!ws[bRef]) {
        ws[bRef] =
          typeof meta.value === 'number'
            ? { t: 'n', v: meta.value }
            : { t: 's', v: meta.value == null ? '' : String(meta.value) };
      }
      ws[aRef].s = styleForCell(0, meta, meta.label);
      ws[bRef].s = styleForCell(1, meta, meta.value);
      if (typeof meta.value === 'number') {
        ws[bRef].t = 'n';
        ws[bRef].v = meta.value;
        ws[bRef].z = meta.percent ? '0.00%' : '0.00';
      }
    }

    return ws;
  }

  function exportCostingExcel(costing, computed) {
    if (typeof XLSX === 'undefined') {
      alert('Excel library still loading. Try again in a moment.');
      return;
    }

    var ws = buildWorksheet(costing, computed);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Costing');
    var fname =
      (costing.client_name || 'Client').replace(/[^\w\-]+/g, '_') +
      '_' +
      (costing.assembly_name || 'Assembly').replace(/[^\w\-]+/g, '_') +
      '.xlsx';
    XLSX.writeFile(wb, fname, { cellStyles: true });
  }

  global.SahasraExport = {
    exportCostingExcel: exportCostingExcel,
    buildRows: buildRows,
    buildWorksheet: buildWorksheet,
    trunc2: trunc2,
    money: global.SahasraFormat
      ? global.SahasraFormat.money
      : function (n) {
          return '$' + (Number(n) || 0).toFixed(2);
        },
  };
})(window);
