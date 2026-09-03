(function (global) {
  'use strict';

  function isNaField(costing, field) {
    if (global.SahasraCompute && global.SahasraCompute.isNaField) {
      return global.SahasraCompute.isNaField(costing, field);
    }
    var list = costing && costing.na_fields;
    return Array.isArray(list) && list.indexOf(field) >= 0;
  }

  function cell(costing, field, fallback) {
    if (isNaField(costing, field)) return 'NA';
    if (costing[field] == null || costing[field] === '') {
      return fallback != null ? fallback : '';
    }
    return costing[field];
  }

  function exportCostingExcel(costing, computed) {
    if (typeof XLSX === 'undefined') {
      alert('Excel library still loading. Try again in a moment.');
      return;
    }

    var pct = computed.percentages || {};
    var rows = [
      ['Assembly Name', costing.assembly_name || ''],
      ['', ''],
      ['Quantity', cell(costing, 'quantity')],
      ['BOM Cost(Amt.)-Elec.', cell(costing, 'bom_cost_elec')],
      ['BOM Cost(Amt.)-Mech.', cell(costing, 'bom_cost_mech')],
      ['PCB Cost(Amt.)', cell(costing, 'pcb_cost')],
      [
        'Freight In & CC @ ' + (pct.freight_in_pct != null ? pct.freight_in_pct : 5) + '%',
        computed.freight_in_cc,
      ],
      ['Material Cost', computed.material_cost],
      [
        'Inventory Carrying Cost @ ' +
          (pct.inventory_carrying_pct != null ? pct.inventory_carrying_pct : 1) +
          '%',
        computed.inventory_carrying_cost,
      ],
      ['Labour Elec.', computed.labour_elec],
      ['Labour Mech.', cell(costing, 'labour_mech')],
      ['Functional & ICT Testing', cell(costing, 'functional_ict_testing')],
      ['Programming', cell(costing, 'programming', 0)],
      ['lubrication grease', cell(costing, 'lubrication_grease')],
      ['AOI', cell(costing, 'aoi')],
      ['PCA labeling', cell(costing, 'pca_labeling')],
      ['Packaging & Forwarding', cell(costing, 'packaging_forwarding')],
      ['Mfg Cost', computed.mfg_cost],
      ['Sub Total 1', computed.sub_total_1],
      [
        'Rejection Cost @ ' + (pct.rejection_pct != null ? pct.rejection_pct : 1) + '%',
        computed.rejection_cost,
      ],
      ['Sub Total 2', computed.sub_total_2],
      [
        'Overheads @ ' + (pct.overhead_pct != null ? pct.overhead_pct : 3) + '%',
        computed.overheads,
      ],
      ['Product Cost', computed.product_cost],
      [
        'Freight Out & CC @ ' + (pct.freight_out_pct != null ? pct.freight_out_pct : 5) + '%',
        computed.freight_out_cc,
      ],
      [
        'Margin @ ' + (pct.margin_pct != null ? pct.margin_pct : 10) + '%',
        computed.margin,
      ],
      ['Quote Price (per unit) USD', computed.quote_price_per_unit],
      ['Order Value', computed.order_value],
      ['Tooling Cost-USD', computed.tooling_cost],
      ['Stencils ', ''],
      ['SMT+PTH', cell(costing, 'smt_pth')],
      ['PCB vendor', cell(costing, 'pcb_vendor')],
      ['PCB Price', cell(costing, 'pcb_price')],
      ['PCB Size', cell(costing, 'pcb_size')],
      ['PCB layer', cell(costing, 'pcb_layer')],
      ['PCB ', isNaField(costing, 'pcb_tooling_override') ? 'NA' : computed.pcb_tooling],
      ['SMT Stencil', cell(costing, 'smt_stencil')],
      ['Mech. and Pkg. Development Tooling', cell(costing, 'mech_pkg_dev_tooling')],
      ['Mic. Tooling', cell(costing, 'misc_tooling')],
      ['Parts LT', cell(costing, 'parts_lead_time')],
      ['Production Lead-Time', cell(costing, 'production_lead_time')],
      ['Engineering LT', cell(costing, 'engineering_lead_time')],
      ['Value Addition', computed.value_addition_pct / 100],
      ['True Margin', costing.true_margin ?? ''],
      ['True Quote Price', costing.true_quote_price ?? ''],
      ['True Value Addition', costing.true_value_addition != null ? costing.true_value_addition / 100 : ''],
    ];

    var ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 42 }, { wch: 18 }];
    // Match sample: Value Addition shows as 18.3% not 0.183
    if (ws.B43) ws.B43.z = '0.0%';
    if (ws.B46) ws.B46.z = '0.0%';

    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Costing');
    var fname =
      (costing.client_name || 'Client').replace(/[^\w\-]+/g, '_') +
      '_' +
      (costing.assembly_name || 'Assembly').replace(/[^\w\-]+/g, '_') +
      '.xlsx';
    XLSX.writeFile(wb, fname);
  }

  global.SahasraExport = {
    exportCostingExcel: exportCostingExcel,
    money: global.SahasraFormat ? global.SahasraFormat.money : function (n) {
      return '$' + (Number(n) || 0).toFixed(2);
    },
  };
})(window);
