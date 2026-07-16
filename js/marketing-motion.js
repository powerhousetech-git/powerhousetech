(function () {
  function showAllReveals() {
    document.querySelectorAll('.reveal').forEach(function (el) {
      el.classList.add('is-visible');
    });
  }

  function initEngagementSteps() {
    var track = document.getElementById('steps-track');
    if (!track) return;
    var cardsRow = document.getElementById('engagement-steps') || track;
    var cards = Array.prototype.slice.call(track.querySelectorAll('.step-card'));
    var fill = document.getElementById('steps-progress-fill');
    if (!cards.length) return;

    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      cards.forEach(function (c) { c.classList.add('is-done', 'is-live'); });
      if (fill) fill.style.width = '100%';
      track.classList.add('is-scrolled');
      return;
    }

    var lastP = -1;
    var lastIdx = -1;
    var ticking = false;
    var mobileMq = window.matchMedia('(max-width: 899px)');

    function paint(progress, forcedIdx) {
      var p = Math.min(1, Math.max(0, progress));
      var max = cards.length - 1;
      var idx = typeof forcedIdx === 'number'
        ? Math.min(max, Math.max(0, forcedIdx))
        : (p >= 0.999 ? max : Math.min(max, Math.floor(p * cards.length)));
      if (Math.abs(p - lastP) < 0.002 && idx === lastIdx) return;
      lastP = p;
      lastIdx = idx;

      track.classList.add('is-scrolled');
      if (fill) fill.style.width = (p * 100) + '%';

      cards.forEach(function (c, n) {
        c.classList.toggle('is-live', n === idx);
        c.classList.toggle('is-done', n < idx || (p >= 0.999 && n === idx));
      });
    }

    function measureMobile() {
      var vh = window.innerHeight || 1;
      var focus = vh * 0.42;
      var idx = 0;
      var best = Infinity;

      cards.forEach(function (c, n) {
        var r = c.getBoundingClientRect();
        var mid = (r.top + r.bottom) / 2;
        var dist = Math.abs(mid - focus);
        if (dist < best) {
          best = dist;
          idx = n;
        }
      });

      // Progress follows the stacked column past the focus line.
      var first = cards[0].getBoundingClientRect();
      var last = cards[cards.length - 1].getBoundingClientRect();
      var travel = Math.max(1, last.bottom - first.top);
      var p = (focus - first.top) / travel;
      paint(p, idx);
    }

    function measureDesktop() {
      var rect = track.getBoundingClientRect();
      var vh = window.innerHeight || 1;
      var h = Math.max(rect.height, cardsRow.getBoundingClientRect().height || 0);
      var margin = Math.min(88, Math.max(48, vh * 0.1));
      var topWhenFullyIn = vh - margin - h;
      var topWhenLeaving = margin;
      var start;
      var end;

      if (topWhenFullyIn > topWhenLeaving + 48) {
        var span = topWhenFullyIn - topWhenLeaving;
        start = topWhenFullyIn - span * 0.08;
        end = topWhenLeaving + span * 0.38;
      } else {
        start = Math.min(vh * 0.62, vh - h * 0.35);
        end = Math.max(vh * 0.28, margin);
        if (start <= end) start = end + Math.min(160, vh * 0.2);
      }

      paint((start - rect.top) / (start - end));
    }

    function measure() {
      if (mobileMq.matches) measureMobile();
      else measureDesktop();
      ticking = false;
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(measure);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', onScroll, { passive: true });
    }
    if (typeof mobileMq.addEventListener === 'function') {
      mobileMq.addEventListener('change', onScroll);
    } else if (typeof mobileMq.addListener === 'function') {
      mobileMq.addListener(onScroll);
    }
    measure();
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        showAllReveals();
        initEngagementSteps();
      });
    } else {
      showAllReveals();
      initEngagementSteps();
    }
    return;
  }

  function initReveal() {
    var els = document.querySelectorAll('.reveal');
    if (!els.length) return;
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    els.forEach(function (el) { io.observe(el); });
  }

  function boot() {
    initReveal();
    initEngagementSteps();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
