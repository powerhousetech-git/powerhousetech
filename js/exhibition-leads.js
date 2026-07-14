(function () {
  var root = document.getElementById('el-how');
  if (!root) return;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var steps = Array.prototype.slice.call(root.querySelectorAll('.el-step'));
  var panels = Array.prototype.slice.call(root.querySelectorAll('.el-panel'));
  var caption = document.getElementById('el-caption');
  var progressFill = document.getElementById('el-progress-fill');
  var progressDots = root.querySelectorAll('#el-progress-dots span');
  var bulkCount = document.getElementById('el-bulk-count');
  var dbCount = document.getElementById('el-db-count');
  var dbSeconds = document.getElementById('el-db-seconds');
  var dbLost = document.getElementById('el-db-lost');
  var ladderSteps = root.querySelectorAll('.el-ladder-step');
  var active = -1;
  var locked = false;
  var auto = true;
  var timer = null;
  var ladderTimer = null;

  var PHASES = ['capture', 'read', 'database', 'mail', 'follow'];
  var DWELL = [3400, 3000, 3200, 3200, 3600];

  var CAPTIONS = [
    'Photos and PDFs drop in together — single cards or a bulk stack after a long show day.',
    'A scan line reads each card. Name, title, company, email, phone, and website fill in cleanly.',
    'In seconds, rows land in your database — de-duplicated, structured, ready to work.',
    'Personalized intros fire from your mailbox, tailored to each contact’s industry.',
    'Day-0, Day-3, Day-7 nudges keep going. Already-contacted leads are skipped. Zero lost.'
  ];

  function setProgress(index) {
    if (progressFill) {
      progressFill.style.width = ((index / (PHASES.length - 1)) * 100) + '%';
    }
    progressDots.forEach(function (d, i) {
      d.classList.toggle('is-on', i <= index);
    });
  }

  function swapCaption(text) {
    if (!caption) return;
    if (reduceMotion) {
      caption.textContent = text;
      return;
    }
    caption.classList.add('is-swap');
    window.setTimeout(function () {
      caption.textContent = text;
      caption.classList.remove('is-swap');
    }, 200);
  }

  function animateCount(el, to, duration) {
    if (!el) return;
    if (reduceMotion) {
      el.textContent = String(to);
      return;
    }
    var from = parseInt(el.textContent, 10) || 0;
    var t0 = performance.now();
    function tick(now) {
      var p = Math.min(1, (now - t0) / duration);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = String(Math.round(from + (to - from) * eased));
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function resetMedia() {
    root.querySelectorAll('.el-media').forEach(function (m) {
      m.classList.remove('is-in');
      void m.offsetWidth;
    });
  }

  function playCapture() {
    resetMedia();
    if (reduceMotion) {
      root.querySelectorAll('.el-media').forEach(function (m) { m.classList.add('is-in'); });
      if (bulkCount) bulkCount.textContent = '48';
      return;
    }
    root.querySelectorAll('.el-media').forEach(function (m) {
      m.classList.add('is-in');
    });
    animateCount(bulkCount, 48, 1400);
  }

  function playDatabase() {
    var rows = root.querySelectorAll('#el-db-rows tr');
    rows.forEach(function (row) {
      row.classList.remove('is-enter');
      void row.offsetWidth;
    });
    rows.forEach(function (row, i) {
      window.setTimeout(function () {
        row.classList.add('is-enter');
      }, reduceMotion ? 0 : 120 + i * 180);
    });
    animateCount(dbCount, 48, 1200);
    if (dbSeconds) dbSeconds.textContent = reduceMotion ? '3' : '0';
    if (!reduceMotion && dbSeconds) {
      window.setTimeout(function () { dbSeconds.textContent = '1'; }, 400);
      window.setTimeout(function () { dbSeconds.textContent = '2'; }, 800);
      window.setTimeout(function () { dbSeconds.textContent = '3'; }, 1100);
    }
    if (dbLost) dbLost.textContent = '0';
  }

  function playFollow() {
    if (ladderTimer) window.clearInterval(ladderTimer);
    ladderSteps.forEach(function (s) {
      s.classList.remove('is-live', 'is-done');
    });
    if (reduceMotion) {
      ladderSteps.forEach(function (s, i) {
        s.classList.add(i < ladderSteps.length - 1 ? 'is-done' : 'is-live');
      });
      return;
    }
    var i = 0;
    function advance() {
      ladderSteps.forEach(function (s, idx) {
        s.classList.toggle('is-done', idx < i);
        s.classList.toggle('is-live', idx === i);
      });
      i += 1;
      if (i >= ladderSteps.length) {
        window.clearInterval(ladderTimer);
        ladderSteps.forEach(function (s) {
          s.classList.remove('is-live');
          s.classList.add('is-done');
        });
      }
    }
    advance();
    ladderTimer = window.setInterval(advance, 900);
  }

  function applyState(index) {
    active = index;
    steps.forEach(function (btn, i) {
      var on = i === index;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    panels.forEach(function (panel) {
      var on = panel.getAttribute('data-phase') === PHASES[index];
      panel.classList.toggle('is-active', on);
    });
    setProgress(index);
    swapCaption(CAPTIONS[index]);

    if (PHASES[index] === 'capture') playCapture();
    if (PHASES[index] === 'database') playDatabase();
    if (PHASES[index] === 'follow') playFollow();
  }

  function goTo(index) {
    if (index < 0 || index >= PHASES.length) return;
    applyState(index);
  }

  function scheduleNext() {
    if (timer) window.clearTimeout(timer);
    if (!auto || locked || reduceMotion) return;
    timer = window.setTimeout(function () {
      if (!auto || locked) return;
      var next = active + 1;
      if (next >= PHASES.length) {
        window.setTimeout(function () {
          if (!auto) return;
          goTo(0);
          scheduleNext();
        }, 2200);
        return;
      }
      goTo(next);
      scheduleNext();
    }, DWELL[active] || 3000);
  }

  steps.forEach(function (btn, i) {
    btn.addEventListener('click', function () {
      auto = false;
      locked = true;
      if (timer) window.clearTimeout(timer);
      goTo(i);
      window.setTimeout(function () { locked = false; }, 500);
    });
  });

  applyState(0);

  if (!reduceMotion && 'IntersectionObserver' in window) {
    var seen = false;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting || seen) return;
        seen = true;
        auto = true;
        scheduleNext();
      });
    }, { threshold: 0.35 });
    io.observe(root);
  } else if (reduceMotion) {
    applyState(0);
  }
})();
