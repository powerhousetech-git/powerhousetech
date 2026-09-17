/**
 * Harshul dashboard — in-memory demo data (v5).
 * Used when the Google Sheet can't be read from the browser.
 * Reshaped around the 7-stage lead model with admin_remark + next_step.
 * Loaded after config/util, before api is exercised.
 */
(function (global) {
  'use strict';
  var U = global.HRSUtil, CFG = global.HRS;

  function relISO(days) { return U.addDays(U.todayKey(), days); } // yyyy-mm-dd
  function ddmmyyyy(key) { var p = key.split('-'); return p[2] + '-' + p[1] + '-' + p[0]; }
  function todayAt(hhmm) { return U.todayKey() + 'T' + hhmm + ':00+05:30'; }

  // Customer master (Sheet1 shape). saleOffset drives the message journey.
  // A realistic spread across all 7 stages; deal_closed customers drive Section 2.
  // [name, phone, product, saleOffset, followUpOffset, employee, status, notes,
  //  upsellPattern, upsellMsg, adminRemark, nextStep]
  var C = [
    ['राजेश शर्मा', '919119188492', 'Floor Tiles', -5, 0, 'Mohit', 'visited', 'Walked in, browsing floor tiles', 'default', '', '', 'Call back re: shade selection'],
    ['प्रिया वर्मा', '919820011223', 'Bath Fittings', -3, 1, 'Ravi', 'interested', 'Wants installation date', 'customised', 'Bought bath fittings → upsell shower panels + bath accessories', 'Priority customer — repeat buyer', 'Share quotation'],
    ['सुनील यादव', '919333445566', 'Sanitaryware', -35, -20, 'Ravi', 'deal_closed', 'Delivered and installed', 'default', '', '', ''],
    ['कविता नायर', '919665544332', 'Floor Tiles', -10, -9, 'Mohit', 'bill_finalised', 'Delivery pending, call back', 'default', '', '', 'Confirm delivery slot'],
    ['अमित पटेल', '919776655443', 'Sanitaryware', -8, -4, 'Ravi', 'bill_executed', 'Awaiting installation crew', 'default', '', 'Installation booked for weekend', 'Schedule site visit'],
    ['रीता गुप्ता', '919554433221', 'Wall Tiles', -15, -1, 'Sunil', 'deal_closed', 'Completed after site visit', 'default', '', '', ''],
    ['मनोज सिंह', '919332211009', 'Floor Tiles', -1, 2, 'Suresh', 'converted', 'Agreed to purchase, finalising bill', 'default', '', '', 'Prepare final bill'],
    ['सीमा राव', '919221100998', 'Wall Tiles', -20, -2, 'Mohit', 'not_interested', 'Went with another vendor', 'default', '', 'Price was the deal-breaker', ''],
    ['विक्रम पटेल', '919443322110', 'Bath Fittings', -12, -4, 'Raju', 'deal_closed', 'Full payment received', 'customised', 'Bought bath fittings → upsell mirrors + storage cabinets', '', ''],
    ['दीपक जोशी', '919000112233', 'Sanitaryware', -6, 1, 'Suresh', 'deal_closed', 'Bought full sanitaryware set', 'default', '', 'Referral source: neighbour', ''],
  ];

  function clients() {
    var headers = ['ग्राहक का नाम', 'मोबाइल', 'स्थिति', 'अगला फॉलोअप', 'कर्मचारी', 'नोट्स', 'बिक्री तारीख', 'प्रोडक्ट', 'एडमिन टिप्पणी', 'अगला कदम'];
    var mapping = {
      customer_name: 'ग्राहक का नाम', phone: 'मोबाइल', status: 'स्थिति',
      follow_up_date: 'अगला फॉलोअप', assigned_to: 'कर्मचारी', notes: 'नोट्स',
      sale_date: 'बिक्री तारीख', product: 'प्रोडक्ट',
      admin_remark: 'एडमिन टिप्पणी', next_step: 'अगला कदम',
    };
    var mapped = C.map(function (r) {
      return {
        customer_name: r[0], phone: r[1], product: r[2],
        sale_date: ddmmyyyy(relISO(r[3])), follow_up_date: ddmmyyyy(relISO(r[4])),
        assigned_to: r[5], status: r[6], notes: r[7],
        admin_remark: r[10] || '', next_step: r[11] || '', _raw: r,
      };
    });
    return { clients: mapped, mapping: mapping, headers: headers };
  }

  // Override map: "<phone>:<stage>" → status (forces a specific step state).
  var OVR = {
    '919333445566:feedback': 'failed',   // सुनील — one failed send
    '919443322110:referral': 'opted_out', // विक्रम — opted out of referral
  };
  // A few messages "sent today" (drives Messages Sent Today + activity).
  var SENT_TODAY = {
    '919000112233:feedback': todayAt('14:30'), // दीपक
    '919443322110:upsell': todayAt('11:05'),   // विक्रम
  };

  function messages() {
    var out = [];
    // Section 2 pipeline only exists for deal_closed customers.
    C.filter(function (r) { return U.normStatus(r[6]) === 'deal_closed'; }).forEach(function (r) {
      var phone = r[1], name = r[0], product = r[2], saleOff = r[3];
      var pattern = r[8], custom = r[9];
      CFG.MESSAGE_STAGES.forEach(function (st) {
        var offset = saleOff + st.day;              // days from today the msg is scheduled
        var schedKey = relISO(offset);
        var status, sentDate = '';
        var forced = OVR[phone + ':' + st.key];
        if (forced) {
          status = forced;
          if (forced === 'sent') sentDate = schedKey;
        } else if (offset < 0) { status = 'sent'; sentDate = schedKey; }
        else { status = 'pending'; }              // offset >= 0 → pending (⏳ if today, · if future)
        var todaySent = SENT_TODAY[phone + ':' + st.key];
        if (todaySent) { status = 'sent'; sentDate = todaySent; }
        out.push({
          customer_phone: phone, customer_name: name, message_type: st.key,
          scheduled_date: schedKey, status: status, sent_date: sentDate, product: product,
          upsell_pattern: pattern, upsell_custom_message: st.key === 'upsell' ? custom : (pattern === 'customised' ? custom : ''),
        });
      });
    });
    return out;
  }

  function employees() {
    return [
      { name: 'Mohit', phone: '919111000111', role: 'Sales' },
      { name: 'Ravi', phone: '919111000222', role: 'Sales' },
      { name: 'Sunil', phone: '919111000333', role: 'Sales' },
      { name: 'Suresh', phone: '919111000444', role: 'Sales' },
      { name: 'Raju', phone: '919111000555', role: 'Sales' },
    ];
  }

  global.HRSDemo = { clients: clients, messages: messages, employees: employees };
})(window);
