(function (global) {
  'use strict';

  function money(n, currency) {
    var sym = currency === 'INR' ? '₹' : '$';
    return sym + (Number(n) || 0).toFixed(2);
  }

  function percent(n, digits) {
    return (Number(n) || 0).toFixed(digits == null ? 1 : digits) + '%';
  }

  function progressLabel(row) {
    if (!row) return '—';
    if (row.status && row.status !== 'draft') {
      return { label: row.status.replace(/_/g, ' '), kind: 'done' };
    }
    var step = Number(row.current_step) || 1;
    if (step >= 7) return { label: 'Ready for review', kind: 'review' };
    return { label: 'Step ' + step + ' of 6', kind: 'pending' };
  }

  global.SahasraFormat = {
    money: money,
    percent: percent,
    progressLabel: progressLabel,
  };
})(window);
