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

    function paint(progress) {
      var p = Math.min(1, Math.max(0, progress));
      var max = cards.length - 1;
      // Match highlight to bar quarters: 01→25%, 02→50%, 03→75%, 04→100%.
      var idx = p >= 0.999 ? max : Math.min(max, Math.floor(p * cards.length));
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

    function measure() {
      var rect = track.getBoundingClientRect();
      var vh = window.innerHeight || 1;
      var h = Math.max(rect.height, cardsRow.getBoundingClientRect().height || 0);
      // Keep the progress scrub inside the window where the full
      // progress line + all four cards can sit on screen together.
      var margin = Math.min(88, Math.max(48, vh * 0.1));
      var topWhenFullyIn = vh - margin - h;
      var topWhenLeaving = margin;
      var start;
      var end;

      if (topWhenFullyIn > topWhenLeaving + 48) {
        // Start once the whole row is visible; finish with cards
        // still well inside the viewport (not at the clip edge).
        var span = topWhenFullyIn - topWhenLeaving;
        start = topWhenFullyIn - span * 0.08;
        end = topWhenLeaving + span * 0.38;
      } else {
        // Short viewports: scrub while the row is centered.
        start = Math.min(vh * 0.62, vh - h * 0.35);
        end = Math.max(vh * 0.28, margin);
        if (start <= end) start = end + Math.min(160, vh * 0.2);
      }

      paint((start - rect.top) / (start - end));
      ticking = false;
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(measure);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
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
