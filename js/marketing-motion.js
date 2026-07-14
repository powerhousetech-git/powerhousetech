(function () {
  function showAllReveals() {
    document.querySelectorAll('.reveal').forEach(function (el) {
      el.classList.add('is-visible');
    });
  }

  function initEngagementSteps() {
    var track = document.getElementById('steps-track');
    if (!track) return;
    var cards = Array.prototype.slice.call(track.querySelectorAll('.step-card'));
    var fill = document.getElementById('steps-progress-fill');
    if (!cards.length) return;

    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      cards.forEach(function (c) { c.classList.add('is-done'); });
      if (fill) fill.style.width = '100%';
      return;
    }

    var idx = 0;
    var timer = null;
    var started = false;

    function paint(i) {
      cards.forEach(function (c, n) {
        c.classList.toggle('is-live', n === i);
        c.classList.toggle('is-done', n < i);
      });
      if (fill) {
        fill.style.width = ((i / Math.max(1, cards.length - 1)) * 100) + '%';
      }
    }

    function tick() {
      paint(idx);
      idx = (idx + 1) % cards.length;
    }

    function start() {
      if (started) return;
      started = true;
      track.classList.add('is-playing');
      tick();
      timer = window.setInterval(tick, 1600);
    }

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            start();
            io.disconnect();
          }
        });
      }, { threshold: 0.35 });
      io.observe(track);
    } else {
      start();
    }

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        if (timer) { window.clearInterval(timer); timer = null; }
      } else if (started && !timer) {
        timer = window.setInterval(tick, 1600);
      }
    });
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
