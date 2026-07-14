(function () {
  function showAllReveals() {
    document.querySelectorAll('.reveal').forEach(function (el) {
      el.classList.add('is-visible');
    });
  }

  function initEngagementSteps() {
    var track = document.getElementById('steps-track');
    if (!track) return;
    var section = document.getElementById('how-it-works') || track;
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
    var ticking = false;

    function paint(progress) {
      var p = Math.min(1, Math.max(0, progress));
      if (Math.abs(p - lastP) < 0.004) return;
      lastP = p;

      track.classList.add('is-scrolled');
      if (fill) fill.style.width = (p * 100) + '%';

      var max = cards.length - 1;
      var idx = Math.min(max, Math.round(p * max));
      cards.forEach(function (c, n) {
        c.classList.toggle('is-live', n === idx);
        c.classList.toggle('is-done', n < idx || p >= 0.98);
      });
    }

    function measure() {
      var rect = section.getBoundingClientRect();
      var vh = window.innerHeight || 1;
      // Fill while the full step row is still on screen:
      // starts as the section settles into view, finishes before it exits.
      var start = vh * 0.72;
      var end = vh * 0.22;
      var raw = (start - rect.top) / (start - end);
      paint(raw);
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
