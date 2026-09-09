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

  /**
   * Sheet "Follow Up Count" includes Mail 1 as 1.
   *   0 / empty → not mailed (or unknown)
   *   1         → Mail 1 only
   *   2+        → real follow-ups sent (display as Follow-up (n-1))
   */
  function followUpTouchCount(lead) {
    var n = Number(lead && lead.follow_up_count);
    return isNaN(n) ? 0 : n;
  }

  function isRealFollowUp(lead) {
    var st = normStatus(lead && lead.status);
    if (FOLLOW_UP_STATUSES.indexOf(st) >= 0) return true;
    // Count ≥ 2 means at least one follow-up after Mail 1
    return followUpTouchCount(lead) >= 2;
  }

  function followUpLabel(lead) {
    var st = normStatus(lead && lead.status);
    var m = st.match(/^follow_up_(\d+)$/);
    if (m) return 'Follow-up ' + m[1] + '/5';
    var n = followUpTouchCount(lead);
    // Count includes Mail 1 — only label real follow-ups (n ≥ 2)
    if (n >= 2) return 'Follow-up ' + (n - 1) + '/5';
    if (n === 1 || st === 'mail_1_sent') return 'Mail 1';
    return '';
  }

  /** Card tone inside MAIL 1 SENT: pos / neg / none */
  function mail1CardTone(lead) {
    var st = normStatus(lead && lead.status);
    if (st === 'discarded') return 'neg';
    if (st === 'meeting_proposed' || st === 'meeting_scheduled' || st === 'human_takeover' ||
        st === 'responded' || st === 'converted') {
      return 'pos';
    }
    return 'none';
  }

  function pipelineBucket(statusOrLead, maybeLead) {
    var lead = (statusOrLead && typeof statusOrLead === 'object') ? statusOrLead : (maybeLead || null);
    var status = normStatus(lead ? lead.status : statusOrLead);

    if (status === 'new' || !status) return 'new';
    if (status === 'converted') return 'converted';
    // Real follow-ups only (status follow_up_* OR Follow Up Count ≥ 2)
    if (isRealFollowUp(lead || { status: status })) return 'follow_up';
    // Mail 1 cohort: first-touch emailed leads (incl. positive/negative replies)
    // Status may be mail_1_sent, responded, meeting_*, discarded, etc.
    return 'mail_1_sent';
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
      // Follow-ups KPI: real follow-ups only (not Mail 1). Count includes Mail 1 as 1.
      if (isRealFollowUp(l)) fus++;
      // Any reply outcome (positive, neutral, or negative) counts as a response
      if (RESPONSE_STATUSES[st]) responded++;
      if (st === 'meeting_proposed') meetingProposed++;
      if (st === 'meeting_scheduled') meetings++;
      if (st === 'human_takeover') humanTakeover++;
      if (st === 'converted') converted++;
      if (st === 'discarded') discarded++;
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
    followUpTouchCount: followUpTouchCount,
    isRealFollowUp: isRealFollowUp,
    followUpLabel: followUpLabel,
    mail1CardTone: mail1CardTone,
    pipelineBucket: pipelineBucket,
    computeKpis: computeKpis,
    findLeadByEmail: findLeadByEmail,
  };
})(window);
