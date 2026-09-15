/**
 * Harshul dashboard — in-memory demo data (v4).
 * Used when the Google Sheet can't be read from the browser.
 * Loaded after config/util, before api is exercised.
 */
(function (global) {
  'use strict';
  var U = global.HRSUtil, CFG = global.HRS;

  function relISO(days) { return U.addDays(U.todayKey(), days); } // yyyy-mm-dd
  function ddmmyyyy(key) { var p = key.split('-'); return p[2] + '-' + p[1] + '-' + p[0]; }
  function todayAt(hhmm) { return U.todayKey() + 'T' + hhmm + ':00+05:30'; }

  // Customer master (Sheet1 shape). saleOffset drives the message journey.
  // [name, phone, product, saleOffset, followUpOffset, employee, status, notes, upsellPattern, upsellMsg]
  var C = [
    ['राजेश शर्मा', '919119188492', 'Floor Tiles', -5, 0, 'Mohit', 'in_progress', 'Confirm tile shade selection', 'default', ''],
    ['प्रिया वर्मा', '919820011223', 'Bath Fittings', -3, 1, 'Ravi', 'new', 'Wants installation date', 'customised', 'Bought bath fittings → upsell shower panels + bath accessories'],
    ['सुनील यादव', '919333445566', 'Sanitaryware', -35, -20, 'Ravi', 'completed', 'Delivered and installed', 'default', ''],
    ['कविता नायर', '919665544332', 'Floor Tiles', -10, -7, 'Mohit', 'in_progress', 'Delivery pending, call back', 'default', ''],
    ['अमित पटेल', '919776655443', 'Sanitaryware', -8, -2, 'Ravi', 'in_progress', 'Wants installation date', 'default', ''],
    ['रीता गुप्ता', '919554433221', 'Wall Tiles', -15, -1, 'Sunil', 'completed', 'Marked done after site visit', 'default', ''],
    ['मनोज सिंह', '919332211009', 'Floor Tiles', -1, 2, 'Suresh', 'new', 'Site visit scheduled', 'default', ''],
    ['सीमा राव', '919221100998', 'Wall Tiles', -20, 0, 'Mohit', 'in_progress', 'Confirm grout colour', 'default', ''],
    ['विक्रम पटेल', '919443322110', 'Bath Fittings', -12, -4, 'Raju', 'in_progress', 'Pending balance payment', 'customised', 'Bought bath fittings → upsell mirrors + storage cabinets'],
    ['दीपक जोशी', '919000112233', 'Sanitaryware', -6, 1, 'Suresh', 'new', 'Requested quotation', 'default', ''],
  ];

  function clients() {
    var headers = ['ग्राहक का नाम', 'मोबाइल', 'स्थिति', 'अगला फॉलोअप', 'कर्मचारी', 'नोट्स', 'बिक्री तारीख', 'प्रोडक्ट'];
    var mapping = {
      customer_name: 'ग्राहक का नाम', phone: 'मोबाइल', status: 'स्थिति',
      follow_up_date: 'अगला फॉलोअप', assigned_to: 'कर्मचारी', notes: 'नोट्स',
      sale_date: 'बिक्री तारीख', product: 'प्रोडक्ट',
    };
    var mapped = C.map(function (r) {
      return {
        customer_name: r[0], phone: r[1], product: r[2],
        sale_date: ddmmyyyy(relISO(r[3])), follow_up_date: ddmmyyyy(relISO(r[4])),
        assigned_to: r[5], status: r[6], notes: r[7], _raw: r,
      };
    });
    return { clients: mapped, mapping: mapping, headers: headers };
  }

  // Override map: "<phone>:<stage>" → status (forces a specific step state).
  var OVR = {
    '919776655443:care_check': 'failed',      // अमित — one failed send
    '919000112233:feedback': 'opted_out',     // दीपक — opted out mid-journey
    '919000112233:upsell': 'opted_out',
    '919000112233:referral': 'opted_out',
  };
  // A few messages "sent today" (drives Messages Sent Today + activity).
  var SENT_TODAY = {
    '919119188492:care_check': todayAt('14:30'),
    '919820011223:thank_you': todayAt('13:15'),
    '919332211009:thank_you': todayAt('11:05'),
    '919221100998:feedback': todayAt('10:20'),
  };

  function messages() {
    var out = [];
    C.forEach(function (r) {
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
