/**
 * Lightweight coach-mark tour for dashboards.
 * Usage: phTour.start({ id, steps: [{ selector, title, body }], onDone })
 */
(function (global) {
  var overlay, card, current = null, index = 0;

  function ensureDom() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.id = 'ph-tour-root';
    overlay.innerHTML =
      '<div class="ph-tour-backdrop"></div>' +
      '<div class="ph-tour-highlight" hidden></div>' +
      '<div class="ph-tour-card" role="dialog" aria-modal="true">' +
      '<p class="ph-tour-step"></p>' +
      '<h3 class="ph-tour-title"></h3>' +
      '<p class="ph-tour-body"></p>' +
      '<div class="ph-tour-actions">' +
      '<button type="button" class="ph-tour-skip">Skip</button>' +
      '<div class="ph-tour-nav">' +
      '<button type="button" class="ph-tour-back">Back</button>' +
      '<button type="button" class="ph-tour-next">Next</button>' +
      '</div></div></div>';
    document.body.appendChild(overlay);
    overlay.querySelector('.ph-tour-skip').onclick = function () {
      finish(true);
    };
    overlay.querySelector('.ph-tour-backdrop').onclick = function () {
      finish(true);
    };
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && current) finish(true);
    });
    overlay.querySelector('.ph-tour-back').onclick = function () {
      go(index - 1);
    };
    overlay.querySelector('.ph-tour-next').onclick = function () {
      if (index >= current.steps.length - 1) finish(false);
      else go(index + 1);
    };
  }

  function storageKey(id) {
    return 'ph_tour_done_' + id;
  }

  function finish(skipped) {
    if (!current) return;
    try {
      localStorage.setItem(storageKey(current.id), skipped ? 'skipped' : 'done');
    } catch (_) {}
    overlay.classList.remove('is-open');
    document.body.classList.remove('ph-tour-active');
    var cb = current.onDone;
    current = null;
    if (typeof cb === 'function') cb({ skipped: skipped });
  }

  function go(i) {
    if (!current) return;
    index = Math.max(0, Math.min(i, current.steps.length - 1));
    var step = current.steps[index];
    var el = step.selector ? document.querySelector(step.selector) : null;
    var hl = overlay.querySelector('.ph-tour-highlight');
    var cardEl = overlay.querySelector('.ph-tour-card');

    overlay.querySelector('.ph-tour-step').textContent =
      'Step ' + (index + 1) + ' of ' + current.steps.length;
    overlay.querySelector('.ph-tour-title').textContent = step.title || '';
    overlay.querySelector('.ph-tour-body').textContent = step.body || '';
    overlay.querySelector('.ph-tour-back').disabled = index === 0;
    overlay.querySelector('.ph-tour-next').textContent =
      index >= current.steps.length - 1 ? 'Done' : 'Next';

    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      var r = el.getBoundingClientRect();
      hl.hidden = false;
      hl.style.top = r.top + window.scrollY - 8 + 'px';
      hl.style.left = r.left + window.scrollX - 8 + 'px';
      hl.style.width = r.width + 16 + 'px';
      hl.style.height = r.height + 16 + 'px';
      var top = r.bottom + window.scrollY + 16;
      if (r.bottom > window.innerHeight * 0.55) {
        top = r.top + window.scrollY - 16 - 180;
      }
      cardEl.style.top = Math.max(16, top) + 'px';
      cardEl.style.left = Math.min(
        window.scrollX + window.innerWidth - 360,
        Math.max(16, r.left + window.scrollX)
      ) + 'px';
    } else {
      hl.hidden = true;
      cardEl.style.top = window.scrollY + 80 + 'px';
      cardEl.style.left = '50%';
      cardEl.style.transform = 'translateX(-50%)';
    }
  }

  function start(opts) {
    if (!opts || !opts.steps || !opts.steps.length) return;
    ensureDom();
    current = opts;
    index = 0;
    overlay.classList.add('is-open');
    document.body.classList.add('ph-tour-active');
    overlay.querySelector('.ph-tour-card').style.transform = '';
    go(0);
  }

  function shouldAutoStart(id) {
    // Never auto-start inside demos iframes — dark overlay reads as a black screen.
    try {
      if (window.self !== window.top) return false;
    } catch (_) {
      return false;
    }
    try {
      return !localStorage.getItem(storageKey(id));
    } catch (_) {
      return false;
    }
  }

  function reset(id) {
    try {
      localStorage.removeItem(storageKey(id));
    } catch (_) {}
  }

  global.phTour = { start: start, shouldAutoStart: shouldAutoStart, reset: reset };
})(window);
