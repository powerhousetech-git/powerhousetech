(function () {
  var root = document.getElementById('ir-how');
  if (!root) return;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var steps = Array.prototype.slice.call(root.querySelectorAll('.ir-step'));
  var caption = document.getElementById('ir-caption');
  var kpiOut = document.getElementById('ir-kpi-out');
  var kpiOver = document.getElementById('ir-kpi-over');
  var kpiCount = document.getElementById('ir-kpi-count');
  var rowFocus = document.getElementById('ir-row-focus');
  var cellParty = document.getElementById('ir-cell-party');
  var cellAmt = document.getElementById('ir-cell-amt');
  var cellDue = document.getElementById('ir-cell-due');
  var cellStage = document.getElementById('ir-cell-stage');
  var overlay = document.getElementById('ir-overlay');
  var dash = document.getElementById('ir-dash');
  var mail = document.getElementById('ir-mail');
  var progressFill = document.getElementById('ir-progress-fill');
  var progressDots = document.querySelectorAll('#ir-progress-dots span');
  var approveBtn = document.getElementById('ir-approve-demo');
  var active = -1;
  var locked = false;
  var auto = true;
  var autoTimer = null;
  var captionTimer = null;

  var PHASES = ['capture', 'read', 'chase', 'approve', 'paid'];
  var DWELL = [3200, 2800, 2800, 3000, 3200];

  var STATES = [
    {
      caption: 'An invoice lands — from email, a photo, or a quick manual entry. Radar picks it up and starts reading.',
      out: '₹13,360', outClass: '',
      over: '₹11,350', overClass: 'is-bad',
      count: '3', countClass: '',
      party: '<span class="shimmer" aria-hidden="true"></span>',
      amt: '<span class="shimmer" aria-hidden="true"></span>',
      due: '<span class="shimmer" aria-hidden="true"></span>',
      stage: '<span class="ir-pill ir-pill--extract is-fresh">Extracting…</span>',
      paid: false,
      enter: true,
      overlay: 'capture'
    },
    {
      caption: 'AI fills amount, due date, and party. Anything uncertain gets a “Needs review” flag — you stay in control.',
      out: '₹13,360', outClass: '',
      over: '₹11,350', overClass: 'is-bad',
      count: '3', countClass: '',
      party: 'Mehta Traders',
      amt: '₹4,800',
      due: '12 Jun',
      stage: '<span class="ir-pill ir-pill--review is-fresh">Needs review</span>',
      paid: false,
      overlay: 'read'
    },
    {
      caption: 'Friendly reminders go out on their own. Firmer stages wait behind an approval gate — nothing harsh sends without you.',
      out: '₹13,360', outClass: '',
      over: '₹11,350', overClass: 'is-bad',
      count: '3', countClass: '',
      party: 'Mehta Traders',
      amt: '₹4,800',
      due: '12 Jun',
      stage: '<span class="ir-pill ir-pill--sent is-fresh">Stage 1 · Sent</span>',
      paid: false,
      overlay: 'chase'
    },
    {
      caption: 'When a firm nudge is due, you get a WhatsApp-style preview: Approve, Snooze, or Skip.',
      out: '₹13,360', outClass: '',
      over: '₹11,350', overClass: 'is-bad',
      count: '3', countClass: '',
      party: 'Mehta Traders',
      amt: '₹4,800',
      due: '12 Jun',
      stage: '<span class="ir-pill ir-pill--gate is-fresh">Approval needed</span>',
      paid: false,
      overlay: 'approve'
    },
    {
      caption: 'They pay via the link — the row flips to Paid, the chase stops, and outstanding ticks down.',
      out: '₹8,560', outClass: 'is-down',
      over: '₹6,550', overClass: 'is-warn',
      count: '2', countClass: 'is-down',
      party: 'Mehta Traders',
      amt: '₹4,800',
      due: '12 Jun',
      stage: '<span class="ir-pill ir-pill--paid is-fresh">Paid</span>',
      paid: true,
      overlay: null
    }
  ];

  function setKpi(el, value, cls) {
    if (!el) return;
    var parent = el.closest('.ir-kpi');
    if (el.textContent !== value && parent) {
      parent.classList.remove('is-tick');
      void parent.offsetWidth;
      parent.classList.add('is-tick');
    }
    el.textContent = value;
    el.className = 'val' + (cls ? ' ' + cls : '');
  }

  function setCell(el, html) {
    if (!el || el.innerHTML === html) return;
    el.innerHTML = html;
  }

  function showOverlay(kind) {
    if (!overlay) return;
    var panels = overlay.querySelectorAll('[data-overlay]');
    var has = !!kind;
    overlay.classList.toggle('is-empty', !has);
    panels.forEach(function (panel) {
      var on = panel.getAttribute('data-overlay') === kind;
      panel.classList.toggle('is-active', on);
      panel.setAttribute('aria-hidden', on ? 'false' : 'true');
    });
  }

  function playMail(phase) {
    if (!mail || reduceMotion) return;
    mail.classList.remove('is-flying');
    if (phase !== 'capture') return;
    void mail.offsetWidth;
    mail.classList.add('is-flying');
  }

  function setProgress(index) {
    if (progressFill) {
      progressFill.style.width = ((index / (STATES.length - 1)) * 100) + '%';
    }
    progressDots.forEach(function (d, i) {
      d.classList.toggle('is-on', i <= index);
    });
  }

  function swapCaption(text) {
    if (!caption) return;
    if (captionTimer) window.clearTimeout(captionTimer);
    if (reduceMotion || caption.textContent === text) {
      caption.textContent = text;
      caption.classList.remove('is-swap');
      return;
    }
    caption.classList.add('is-swap');
    captionTimer = window.setTimeout(function () {
      caption.textContent = text;
      caption.classList.remove('is-swap');
      captionTimer = null;
    }, 320);
  }

  function applyState(index) {
    var s = STATES[index];
    if (!s) return;
    var prev = active;
    active = index;
    steps.forEach(function (btn, i) {
      var on = i === index;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    swapCaption(s.caption);
    setKpi(kpiOut, s.out, s.outClass);
    setKpi(kpiOver, s.over, s.overClass);
    setKpi(kpiCount, s.count, s.countClass);
    setCell(cellParty, s.party);
    setCell(cellAmt, s.amt);
    setCell(cellDue, s.due);
    setCell(cellStage, s.stage);
    if (rowFocus) {
      rowFocus.classList.toggle('is-paid', !!s.paid);
      rowFocus.classList.add('is-focus');
      if (s.enter && prev !== index) {
        rowFocus.classList.remove('is-enter');
        void rowFocus.offsetWidth;
        rowFocus.classList.add('is-enter');
      }
    }
    var phase = PHASES[index] || 'capture';
    if (dash) dash.setAttribute('data-phase', phase);
    setProgress(index);
    showOverlay(s.overlay);
    if (prev !== index) playMail(phase);
  }

  function goTo(index) {
    if (index < 0 || index >= STATES.length) return;
    applyState(index);
  }

  function clearAuto() {
    if (autoTimer) {
      window.clearTimeout(autoTimer);
      autoTimer = null;
    }
  }

  function scheduleNext(i) {
    clearAuto();
    if (!auto || locked || reduceMotion) return;
    var dwell = DWELL[i] || 2800;
    autoTimer = window.setTimeout(function () {
      if (!auto || locked) return;
      var next = i + 1;
      if (next >= STATES.length) {
        autoTimer = window.setTimeout(function () {
          if (!auto || locked) return;
          goTo(0);
          scheduleNext(0);
        }, 2200);
        return;
      }
      goTo(next);
      scheduleNext(next);
    }, dwell);
  }

  steps.forEach(function (btn, i) {
    btn.addEventListener('click', function () {
      auto = false;
      locked = true;
      clearAuto();
      goTo(i);
      window.setTimeout(function () { locked = false; }, 700);
    });
  });

  if (approveBtn) {
    approveBtn.addEventListener('click', function () {
      auto = false;
      clearAuto();
      goTo(4);
    });
  }

  applyState(0);

  if (!reduceMotion && 'IntersectionObserver' in window) {
    var seen = false;
    var sectionIo = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting || seen) return;
          seen = true;
          scheduleNext(0);
        });
      },
      { threshold: 0.3 }
    );
    sectionIo.observe(root);
  }
})();
