/**
 * Harshul dashboard — in-memory demo data.
 * Used when the Google Sheet can't be read from the browser (not shared
 * publicly / offline). Lets the UI render fully for review.
 * Loaded after util.js, before api.js is exercised.
 */
(function (global) {
  'use strict';
  var U = global.HRSUtil;

  // Date N days from today (IST) as DD-MM-YYYY (to exercise the parser).
  function rel(days) {
    var d = new Date();
    d.setDate(d.getDate() + days);
    var key = U.istKey(d); // yyyy-mm-dd
    var p = key.split('-');
    return p[2] + '-' + p[1] + '-' + p[0];
  }

  function clients() {
    var rows = [
      ['राजेश शर्मा', '919119188492', 'in_progress', rel(0), 'Mohit', 'Wants glossy floor tiles', rel(-2), 'Floor Tiles'],
      ['प्रिया वर्मा', '919820011223', 'new', rel(2), 'Raju', 'Enquiry for bathroom fittings', rel(0), 'Bath Fittings'],
      ['दीपक जोशी', '919000112233', 'in_progress', rel(-1), 'Suresh', 'Follow up on wall tile sample', rel(-5), 'Wall Tiles'],
      ['सुनील यादव', '919333445566', 'completed', rel(-10), 'Mohit', 'Delivered and installed', rel(-14), 'Sanitaryware'],
      ['विक्रम पटेल', '919776655443', 'in_progress', rel(-4), 'Raju', 'Pending balance payment', rel(-7), 'Floor Tiles'],
      ['कविता नायर', '919665544332', 'in_progress', rel(-8), 'Suresh', 'Needs grouting advice', rel(-12), 'Wall Tiles'],
      ['रमेश कुमार', '919554433221', 'new', rel(5), 'Mohit', 'Requested quotation', rel(-1), 'Bath Fittings'],
      ['अंजली गुप्ता', '919443322110', 'cancelled', rel(-3), 'Raju', 'Chose another vendor', rel(-9), 'Sanitaryware'],
      ['मनोज सिंह', '919332211009', 'in_progress', rel(0), 'Suresh', 'Site visit scheduled', rel(-3), 'Floor Tiles'],
      ['सीमा राव', '919221100998', 'in_progress', rel(-6), 'Mohit', 'Awaiting stock', rel(-6), 'Wall Tiles'],
    ];
    var headers = ['ग्राहक का नाम', 'मोबाइल', 'स्थिति', 'अगला फॉलोअप', 'कर्मचारी', 'नोट्स', 'बिक्री तारीख', 'प्रोडक्ट'];
    // Vertical AI_Config mapping: standard_field → actual (Hindi) column.
    var mapping = {
      customer_name: 'ग्राहक का नाम', phone: 'मोबाइल', status: 'स्थिति',
      follow_up_date: 'अगला फॉलोअप', assigned_to: 'कर्मचारी', notes: 'नोट्स',
      sale_date: 'बिक्री तारीख', product: 'प्रोडक्ट',
    };
    var mapped = rows.map(function (r) {
      return {
        customer_name: r[0], phone: r[1], status: r[2], follow_up_date: r[3],
        assigned_to: r[4], notes: r[5], sale_date: r[6], product: r[7], _raw: r,
      };
    });
    return { clients: mapped, mapping: mapping, headers: headers };
  }

  function replies() {
    function ago(mins) { var d = new Date(); d.setMinutes(d.getMinutes() - mins); return d.toISOString(); }
    return [
      { ts: ago(12), from: '919119188492', name: 'राजेश शर्मा', message: 'Tiles delivered, thank you!', type: 'text', id: 'wamid.demo1' },
      { ts: ago(95), from: '919000112233', name: 'दीपक जोशी', message: 'Can you send the wall tile catalogue?', type: 'text', id: 'wamid.demo2' },
      { ts: ago(240), from: '919776655443', name: 'विक्रम पटेल', message: 'I will pay the balance tomorrow.', type: 'text', id: 'wamid.demo3' },
      { ts: ago(1400), from: '919665544332', name: 'कविता नायर', message: 'What grout colour do you recommend?', type: 'text', id: 'wamid.demo4' },
    ];
  }

  function employees() {
    return [
      { name: 'Mohit', phone: '919111000111', role: 'Sales' },
      { name: 'Raju', phone: '919111000222', role: 'Sales' },
      { name: 'Suresh', phone: '919111000333', role: 'Sales' },
      { name: 'Harshul', phone: '919119188492', role: 'Owner' },
    ];
  }

  global.HRSDemo = { clients: clients, replies: replies, employees: employees };
})(window);
