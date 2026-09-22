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
    // Booked / converted / discarded are their own stages — not Follow-up
    if (st === 'meeting_scheduled' || st === 'converted' || st === 'discarded') return false;
    if (FOLLOW_UP_STATUSES.indexOf(st) >= 0) return true;
    // Count ≥ 2 means at least one follow-up after Mail 1
    return followUpTouchCount(lead) >= 2;
  }

  function followUpLabel(lead) {
    var st = normStatus(lead && lead.status);
    if (st === 'meeting_scheduled') return 'Meeting scheduled';
    if (st === 'converted' || st === 'discarded') return '';
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
    if (st === 'meeting_proposed' || st === 'human_takeover' ||
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
    // Calendly-confirmed booking — own column (distinct from Meeting Proposed)
    if (status === 'meeting_scheduled') return 'meeting_scheduled';
    // Real follow-ups only (status follow_up_* OR Follow Up Count ≥ 2)
    if (isRealFollowUp(lead || { status: status })) return 'follow_up';
    // Mail 1 cohort: first-touch emailed leads (incl. positive/negative replies,
    // meeting_proposed). Colour-coded on the board.
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
    // Funnel includes Meeting Proposed + Meeting Scheduled as separate stages
    var funnel = [
      { key: 'new', label: 'New', count: newCount },
      { key: 'mail_1_sent', label: 'Emailed', count: mail1 },
      { key: 'follow_up', label: 'Follow-ups', count: fus },
      { key: 'responded', label: 'Responses', count: responded },
      { key: 'meeting_proposed', label: 'Meeting Proposed', count: meetingProposed },
      { key: 'meeting_scheduled', label: 'Meeting Scheduled', count: meetings },
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

  /** Detect whether a portal-data payload looks like Audit Log rows (not Sheet1 leads). */
  function looksLikeAuditRows(rows) {
    if (!rows || !rows.length) return false;
    var r = rows[0] || {};
    return !!(r.event_type || r['event_type'] || r.Event || r['Event Type'] ||
      r.old_status || r['Old Status'] || r.new_status || r['New Status'] ||
      r.triggered_by || r['Triggered By'] || r.lead_email || r['Lead Email']);
  }

  function normalizeAuditEvent(row) {
    row = row || {};
    return {
      timestamp: row.timestamp || row.Timestamp || row['Created At'] || '',
      lead_email: String(row.lead_email || row['Lead Email'] || row.Email || '').toLowerCase().trim(),
      lead_name: row.lead_name || row['Lead Name'] || row.Name || '',
      event_type: String(row.event_type || row['Event Type'] || row.Event || 'status_changed').toLowerCase().trim().replace(/\s+/g, '_'),
      old_status: row.old_status || row['Old Status'] || '',
      new_status: row.new_status || row['New Status'] || '',
      details: row.details || row.Details || row.detail || '',
      triggered_by: row.triggered_by || row['Triggered By'] || row.Source || '',
    };
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
    looksLikeAuditRows: looksLikeAuditRows,
    normalizeAuditEvent: normalizeAuditEvent,
  };
})(window);
