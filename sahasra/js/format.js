(function (global) {
  'use strict';

  function money(n, currency) {
    if (n == null || n === '') return '—';
    var sym = currency === 'INR' ? '₹' : '$';
    return sym + (Number(n) || 0).toFixed(2);
  }

  function percent(n, digits) {
    if (n == null || n === '') return '—';
    return (Number(n) || 0).toFixed(digits == null ? 1 : digits) + '%';
  }

  function needsTrueValue(row) {
    if (!row || row.status !== 'final') return false;
    return (
      row.true_margin == null ||
      row.true_quote_price == null ||
      row.true_value_addition == null
    );
  }

  function progressLabel(row) {
    if (!row) return { label: '—', kind: 'pending' };
    var st = row.status || 'draft';
    if (st === 'final') {
      return needsTrueValue(row)
        ? { label: 'Needs true value', kind: 'review' }
        : { label: 'Final', kind: 'done' };
    }
    if (st === 'in_review') return { label: 'In review', kind: 'review' };
    if (st === 'submitted') return { label: 'Final', kind: 'done' };
    var step = Number(row.current_step) || 1;
    if (step >= 7) return { label: 'Ready for review', kind: 'review' };
    return { label: 'Step ' + step + ' of 6', kind: 'pending' };
  }

  function statusLabel(row) {
    var st = (row && row.status) || 'draft';
    if (st === 'submitted') return 'final';
    return st.replace(/_/g, ' ');
  }

  global.SahasraFormat = {
    money: money,
    percent: percent,
    progressLabel: progressLabel,
    needsTrueValue: needsTrueValue,
    statusLabel: statusLabel,
  };
})(window);
