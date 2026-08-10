/**
 * Lightweight coach-mark tour for dashboards.
 * Usage: phTour.start({ id, steps: [{ selector, title, body }], onDone })
 */
(function (global) {
  var overlay = null;
  var current = null;
  var index = 0;

  function ensureDom() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'ph-tour-root';
    overlay.setAttribute('aria-live', 'polite');
    overlay.innerHTML =
      '<div class="ph-tour-backdrop" data-tour-dismiss></div>' +
      '<div class="ph-tour-highlight" hidden></div>' +
      '<div class="ph-tour-card" role="dialog" aria-modal="true" aria-labelledby="ph-tour-title">' +
      '<p class="ph-tour-step"></p>' +
      '<h3 class="ph-tour-title" id="ph-tour-title"></h3>' +
      '<p class="ph-tour-body"></p>' +
      '<div class="ph-tour-actions">' +
      '<button type="button" class="ph-tour-skip">Skip</button>' +
      '<div class="ph-tour-nav">' +
      '<button type="button" class="ph-tour-back">Back</button>' +
      '<button type="button" class="ph-tour-next">Next</button>' +
      '</div></div></div>';
    document.body.appendChild(overlay);

    overlay.querySelector('.ph-tour-skip').addEventListener('click', function () {
      finish(true);
    });
    overlay.querySelector('[data-tour-dismiss]').addEventListener('click', function () {
      finish(true);
    });
    overlay.querySelector('.ph-tour-back').addEventListener('click', function () {
      go(index - 1);
    });
    overlay.querySelector('.ph-tour-next').addEventListener('click', function () {
      if (index >= current.steps.length - 1) finish(false);
      else go(index + 1);
    });
    document.addEventListener('keydown', function (e) {
      if (!current) return;
      if (e.key === 'Escape') finish(true);
      if (e.key === 'ArrowRight') {
        if (index >= current.steps.length - 1) finish(false);
        else go(index + 1);
      }
      if (e.key === 'ArrowLeft') go(index - 1);
    });
    return overlay;
  }

  function storageKey(id) {
    return 'ph_tour_done_' + id;
  }

  function finish(skipped) {
    if (!current || !overlay) return;
    try {
      localStorage.setItem(storageKey(current.id), skipped ? 'skipped' : 'done');
    } catch (_) {}
    overlay.classList.remove('is-open');
    document.body.classList.remove('ph-tour-active');
    var hl = overlay.querySelector('.ph-tour-highlight');
    if (hl) hl.hidden = true;
    var cb = current.onDone;
    current = null;
    if (typeof cb === 'function') cb({ skipped: !!skipped });
  }

  function placeCard(cardEl, anchorRect) {
    var margin = 16;
    var cardW = Math.min(340, window.innerWidth - margin * 2);
    var cardH = Math.min(220, window.innerHeight - margin * 2);
    var left;
    var top;

    if (anchorRect) {
      left = Math.min(
        window.innerWidth - cardW - margin,
        Math.max(margin, anchorRect.left)
      );
      // Prefer below the target; flip above if not enough room.
      if (anchorRect.bottom + 16 + cardH < window.innerHeight - margin) {
        top = anchorRect.bottom + 16;
      } else if (anchorRect.top - 16 - cardH > margin) {
        top = anchorRect.top - 16 - cardH;
      } else {
        top = Math.max(margin, (window.innerHeight - cardH) / 2);
      }
    } else {
      left = Math.max(margin, (window.innerWidth - cardW) / 2);
      top = Math.max(margin, Math.min(120, (window.innerHeight - cardH) / 3));
    }

    cardEl.style.transform = 'none';
    cardEl.style.width = cardW + 'px';
    cardEl.style.left = left + 'px';
    cardEl.style.top = top + 'px';
  }

  function go(i) {
    if (!current || !overlay) return;
    index = Math.max(0, Math.min(i, current.steps.length - 1));
    var step = current.steps[index] || {};

    // Optional: switch demo view before measuring the target.
    if (step.view && typeof current.navigate === 'function') {
      try { current.navigate(step.view); } catch (_) {}
    }
    if (typeof step.before === 'function') {
      try { step.before(); } catch (_) {}
    }

    var hl = overlay.querySelector('.ph-tour-highlight');
    var cardEl = overlay.querySelector('.ph-tour-card');
    var el = null;
    try {
      if (step.selector) el = document.querySelector(step.selector);
    } catch (_) {
      el = null;
    }

    // Only highlight targets that are currently visible (active view).
    if (el) {
      var view = el.closest('.view');
      if (view) {
        // Invoice sample uses .hidden; shared demos use .view.active
        if (view.classList.contains('hidden')) el = null;
        else if (
          view.parentElement &&
          view.parentElement.querySelector('.view.active') &&
          !view.classList.contains('active')
        ) {
          el = null;
        }
      }
      // Hidden sections
      if (el && (el.offsetParent === null && getComputedStyle(el).position !== 'fixed')) {
        var cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') el = null;
      }
    }

    overlay.querySelector('.ph-tour-step').textContent =
      'Step ' + (index + 1) + ' of ' + current.steps.length;
    overlay.querySelector('.ph-tour-title').textContent = step.title || '';
    overlay.querySelector('.ph-tour-body').textContent = step.body || '';
    overlay.querySelector('.ph-tour-back').disabled = index === 0;
    overlay.querySelector('.ph-tour-next').textContent =
      index >= current.steps.length - 1 ? 'Done' : 'Next';

    // After a view switch, wait a frame so layout settles.
    requestAnimationFrame(function () {
      if (!current || !overlay) return;
      if (!el && step.selector) {
        try { el = document.querySelector(step.selector); } catch (_) { el = null; }
        if (el) {
          var v2 = el.closest('.view');
          if (v2 && v2.classList.contains('hidden')) el = null;
          else if (
            v2 &&
            v2.parentElement &&
            v2.parentElement.querySelector('.view.active') &&
            !v2.classList.contains('active')
          ) {
            el = null;
          }
        }
      }

      if (el) {
        try {
          el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        } catch (_) {}
        requestAnimationFrame(function () {
          if (!current || !overlay) return;
          var backdrop = overlay.querySelector('.ph-tour-backdrop');
          var r = el.getBoundingClientRect();
          if (r.width < 4 || r.height < 4) {
            hl.hidden = true;
            if (backdrop) backdrop.style.opacity = '1';
            placeCard(cardEl, null);
            return;
          }
          hl.hidden = false;
          if (backdrop) backdrop.style.opacity = '0';
          hl.style.top = Math.max(8, r.top - 8) + 'px';
          hl.style.left = Math.max(8, r.left - 8) + 'px';
          hl.style.width = Math.min(window.innerWidth - 16, r.width + 16) + 'px';
          hl.style.height = Math.min(window.innerHeight - 16, r.height + 16) + 'px';
          placeCard(cardEl, r);
        });
      } else {
        hl.hidden = true;
        var backdrop = overlay.querySelector('.ph-tour-backdrop');
        if (backdrop) backdrop.style.opacity = '1';
        placeCard(cardEl, null);
      }
    });
  }

  function start(opts) {
    if (!opts || !opts.steps || !opts.steps.length) return;
    ensureDom();
    current = opts;
    index = 0;
    overlay.classList.add('is-open');
    document.body.classList.add('ph-tour-active');
    go(0);
    // Focus next for keyboard users
    try {
      overlay.querySelector('.ph-tour-next').focus();
    } catch (_) {}
  }

  function shouldAutoStart() {
    // Never auto-start — demos were covered by a dark overlay.
    return false;
  }

  function reset(id) {
    try {
      localStorage.removeItem(storageKey(id));
    } catch (_) {}
  }

  global.phTour = { start: start, shouldAutoStart: shouldAutoStart, reset: reset };
})(window);
