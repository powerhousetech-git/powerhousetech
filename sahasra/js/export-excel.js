(function (global) {
  'use strict';

  function exportCostingExcel(costing, computed) {
    if (typeof XLSX === 'undefined') {
      alert('Excel library still loading. Try again in a moment.');
      return;
    }

    var rows = [
      ['Assembly Name', costing.assembly_name || ''],
      ['', ''],
      ['Quantity', costing.quantity || ''],
      ['BOM Cost(Amt.)-Elec.', costing.bom_cost_elec ?? ''],
      ['BOM Cost(Amt.)-Mech.', costing.bom_cost_mech ?? ''],
      ['PCB Cost(Amt.)', costing.pcb_cost ?? ''],
      ['Freight In & CC(%) ', computed.freight_in_cc],
      ['Material Cost', computed.material_cost],
      ['Inventory Carrying Cost @ 1%', computed.inventory_carrying_cost],
      ['Labour Elec.', computed.labour_elec],
      ['Labour Mech.', costing.labour_mech ?? ''],
      ['Functional & ICT Testing', costing.functional_ict_testing ?? ''],
      ['Programming', costing.programming ?? 0],
      ['lubrication grease', costing.lubrication_grease ?? ''],
      ['AOI', costing.aoi ?? ''],
      ['PCA labeling', costing.pca_labeling ?? ''],
      ['Packaging & Forwarding', costing.packaging_forwarding ?? ''],
      ['Mfg Cost', computed.mfg_cost],
      ['Sub Total 1', computed.sub_total_1],
      ['Rejection Cost @ 1%', computed.rejection_cost],
      ['Sub Total 2', computed.sub_total_2],
      ['Overheads @ 3%', computed.overheads],
      ['Product Cost', computed.product_cost],
      ['Freight Out & CC(%) ', computed.freight_out_cc],
      ['Margin (%)', computed.margin],
      ['Quote Price (per unit) USD', computed.quote_price_per_unit],
      ['Order Value', computed.order_value],
      ['Tooling Cost-USD', computed.tooling_cost],
      ['Stencils ', ''],
      ['SMT+PTH', costing.smt_pth ?? ''],
      ['PCB vendor', costing.pcb_vendor ?? ''],
      ['PCB Price', costing.pcb_price ?? ''],
      ['PCB Size', costing.pcb_size ?? ''],
      ['PCB layer', costing.pcb_layer ?? ''],
      ['PCB ', computed.pcb_tooling],
      ['SMT Stencil', costing.smt_stencil ?? ''],
      ['Mech. and Pkg. Development Tooling', costing.mech_pkg_dev_tooling ?? ''],
      ['Mic. Tooling', costing.misc_tooling ?? ''],
      ['Parts LT', costing.parts_lead_time ?? ''],
      ['Production Lead-Time', costing.production_lead_time ?? ''],
      ['Engineering LT', costing.engineering_lead_time ?? ''],
      ['Value Addition', computed.value_addition_pct / 100],
    ];

    var ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 38 }, { wch: 18 }];
    // Match sample: Value Addition shows as 18.3% not 0.183
    if (ws.B43) ws.B43.z = '0.0%';

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
