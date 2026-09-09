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

  function pipelineBucket(statusOrLead, maybeLead) {
    var lead = (statusOrLead && typeof statusOrLead === 'object') ? statusOrLead : (maybeLead || null);
    var status = normStatus(lead ? lead.status : statusOrLead);
    var fu = lead && lead.follow_up_count != null ? Number(lead.follow_up_count) : NaN;

    if (status === 'new') return 'new';
    // Sheet often keeps Status=mail_1_sent after follow-ups — use Follow Up Count too
    if (FOLLOW_UP_STATUSES.indexOf(status) >= 0 || (status === 'mail_1_sent' && !isNaN(fu) && fu > 0)) {
      return 'follow_up';
    }
    if (status === 'mail_1_sent') return 'mail_1_sent';
    if (status === 'responded') return 'responded';
    // Meeting proposed / meeting / human takeover → one Meeting column
    if (status === 'meeting_proposed' || status === 'meeting_scheduled' || status === 'human_takeover') {
      return 'meeting_proposed';
    }
    if (status === 'converted') return 'converted';
    if (status === 'discarded') return 'discarded';
    return 'new';
  }

  function computeKpis(leads) {
    leads = leads || [];
    var total = leads.length;
    var mail1 = 0, fus = 0, responded = 0, meetings = 0, meetingProposed = 0, humanTakeover = 0, converted = 0, discarded = 0, contacted = 0;
    var RESPONSE_STATUSES = {
      responded: true,
      meeting_proposed: true,
      meeting_scheduled: true,
      human_takeover: true,
      converted: true,
      discarded: true,
    };
    leads.forEach(function (l) {
      var st = normStatus(l.status);
      if (st === 'mail_1_sent' || FOLLOW_UP_STATUSES.indexOf(st) >= 0 || st === 'responded' ||
          st === 'meeting_proposed' || st === 'meeting_scheduled' || st === 'human_takeover' || st === 'converted' || st === 'discarded') contacted++;
      // Count every lead past "new" — they all received at least Mail 1
      if (st !== 'new') mail1++;
      if (FOLLOW_UP_STATUSES.indexOf(st) >= 0) fus++;
      // Any reply outcome (positive, neutral, or negative) counts as a response
      if (RESPONSE_STATUSES[st]) responded++;
      if (st === 'meeting_proposed') meetingProposed++;
      if (st === 'meeting_scheduled') meetings++;
      if (st === 'human_takeover') humanTakeover++;
      if (st === 'converted') converted++;
      if (st === 'discarded') discarded++;
      var n = Number(l.follow_up_count);
      if (!isNaN(n) && n > 0 && FOLLOW_UP_STATUSES.indexOf(st) < 0 && st !== 'mail_1_sent') {
        // count already reflected via status usually
      }
    });
    // Meeting interest = proposed + booked (+ human takeover after Calendly)
    var meetingsTotal = meetingProposed + meetings + humanTakeover;
    // Meeting conversion = share of contacted leads that reached meeting proposed/finalized
    var rate = contacted ? Math.round((meetingsTotal / contacted) * 1000) / 10 : 0;
    var newCount = leads.filter(function (l) { return pipelineBucket(l) === 'new'; }).length;
    // Funnel bars use the SAME definitions as dashboard KPI cards (not exclusive pipeline buckets)
    var funnel = [
      { key: 'new', label: 'New', count: newCount },
      { key: 'mail_1_sent', label: 'Emailed', count: mail1 },
      { key: 'follow_up', label: 'Follow-ups', count: fus },
      { key: 'responded', label: 'Responses', count: responded },
      { key: 'meeting', label: 'Meetings', count: meetingsTotal },
      { key: 'converted', label: 'Converted', count: converted },
      { key: 'discarded', label: 'Discarded', count: discarded },
    ];
    return {
      total_leads: total,
      mail_1_sent: mail1,
      follow_ups_sent: fus,
      responses: responded,
      responded_leads: responded,
      meetings_proposed: meetingProposed,
      meetings_scheduled: meetings,
      meetings: meetingsTotal,
      human_takeover: humanTakeover,
      converted_leads: converted,
      discarded_leads: discarded,
      contacted_leads: contacted,
      conversion_rate: rate,
      meeting_conversion_rate: rate,
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
