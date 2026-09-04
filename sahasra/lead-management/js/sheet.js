/**
 * PS2 v6 — sheet row helpers (master Google Sheet).
 * Loaded after config.js / api.js.
 */
(function (global) {
  'use strict';

  var FOLLOW_UP_STATUSES = [
    'follow_up_1', 'follow_up_2', 'follow_up_3', 'follow_up_4', 'follow_up_5',
    'follow_up_6', 'follow_up_7', 'follow_up_8', 'follow_up_9', 'follow_up_10',
  ];

  function normStatus(s) {
    s = String(s || 'new').trim().toLowerCase().replace(/\s+/g, '_');
    var aliases = {
      'mail1_sent': 'mail_1_sent',
      'mail_1': 'mail_1_sent',
      'meeting': 'meeting_scheduled',
      'meeting_booked': 'meeting_scheduled',
      'fu_1': 'follow_up_1', 'fu_2': 'follow_up_2', 'fu_3': 'follow_up_3',
      'fu_4': 'follow_up_4', 'fu_5': 'follow_up_5',
    };
    return aliases[s] || s || 'new';
  }

  function followUpLabel(lead) {
    var st = normStatus(lead.status);
    var n = Number(lead.follow_up_count);
    if (!isNaN(n) && n > 0) return 'Follow-up ' + n + '/5';
    var m = st.match(/^follow_up_(\d+)$/);
    if (m) return 'Follow-up ' + m[1] + '/5';
    return '';
  }

  function pipelineBucket(status) {
    status = normStatus(status);
    if (status === 'new') return 'new';
    if (status === 'mail_1_sent') return 'mail_1_sent';
    if (FOLLOW_UP_STATUSES.indexOf(status) >= 0) return 'follow_up';
    if (status === 'responded') return 'responded';
    if (status === 'meeting_scheduled') return 'meeting_scheduled';
    if (status === 'converted') return 'converted';
    if (status === 'discarded') return 'discarded';
    return 'new';
  }

  function computeKpis(leads) {
    leads = leads || [];
    var total = leads.length;
    var mail1 = 0, fus = 0, responded = 0, meetings = 0, converted = 0, discarded = 0, contacted = 0;
    leads.forEach(function (l) {
      var st = normStatus(l.status);
      if (st === 'mail_1_sent' || FOLLOW_UP_STATUSES.indexOf(st) >= 0 || st === 'responded' ||
          st === 'meeting_scheduled' || st === 'converted') contacted++;
      if (st === 'mail_1_sent') mail1++;
      if (FOLLOW_UP_STATUSES.indexOf(st) >= 0) fus++;
      if (st === 'responded') responded++;
      if (st === 'meeting_scheduled') meetings++;
      if (st === 'converted') converted++;
      if (st === 'discarded') discarded++;
      var n = Number(l.follow_up_count);
      if (!isNaN(n) && n > 0 && FOLLOW_UP_STATUSES.indexOf(st) < 0 && st !== 'mail_1_sent') {
        // count already reflected via status usually
      }
    });
    var rate = contacted ? Math.round((converted / contacted) * 1000) / 10 : 0;
    var funnel = [
      { key: 'new', label: 'New', count: leads.filter(function (l) { return pipelineBucket(l.status) === 'new'; }).length },
      { key: 'mail_1_sent', label: 'Mail 1 Sent', count: leads.filter(function (l) { return pipelineBucket(l.status) === 'mail_1_sent'; }).length },
      { key: 'follow_up', label: 'Follow-up', count: leads.filter(function (l) { return pipelineBucket(l.status) === 'follow_up'; }).length },
      { key: 'responded', label: 'Responded', count: responded },
      { key: 'meeting_scheduled', label: 'Meeting', count: meetings },
      { key: 'converted', label: 'Converted', count: converted },
      { key: 'discarded', label: 'Discarded', count: discarded },
    ];
    return {
      total_leads: total,
      mail_1_sent: mail1,
      follow_ups_sent: fus,
      responses: responded,
      responded_leads: responded,
      meetings_scheduled: meetings,
      converted_leads: converted,
      discarded_leads: discarded,
      contacted_leads: contacted,
      conversion_rate: rate,
      funnel: funnel,
    };
  }

  function findLeadByEmail(leads, email) {
    email = String(email || '').trim().toLowerCase();
    if (!email) return null;
    for (var i = 0; i < (leads || []).length; i++) {
      if (String(leads[i].email || '').trim().toLowerCase() === email) return leads[i];
    }
    return null;
  }

  global.PS2Sheet = {
    FOLLOW_UP_STATUSES: FOLLOW_UP_STATUSES,
    normStatus: normStatus,
    followUpLabel: followUpLabel,
    pipelineBucket: pipelineBucket,
    computeKpis: computeKpis,
    findLeadByEmail: findLeadByEmail,
  };
})(window);
