(function () {
  var stage = document.getElementById('vs-stage');
  if (!stage) return;

  var hint = document.getElementById('vs-hint');
  var tabs = stage.querySelectorAll('.vs-tab');
  var panels = {
    earlier: stage.querySelector('[data-panel="earlier"]'),
    now: stage.querySelector('[data-panel="now"]')
  };
  var hints = {
    earlier: stage.getAttribute('data-hint-earlier') || 'Manual outreach — slow, inconsistent, things fall through',
    now: stage.getAttribute('data-hint-now') || 'Hands-off outreach — warm leads surface in your inbox'
  };
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var autoPlayed = false;

  function setState(state, animate) {
    if (state !== 'earlier' && state !== 'now') return;
    stage.setAttribute('data-state', state);

    tabs.forEach(function (tab) {
      var on = tab.getAttribute('data-vs') === state;
      tab.classList.toggle('is-active', on);
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
    });

    Object.keys(panels).forEach(function (key) {
      var panel = panels[key];
      if (!panel) return;
      if (key === state) {
        panel.hidden = false;
        if (animate !== false) {
          panel.classList.remove('is-animating');
          void panel.offsetWidth;
          panel.classList.add('is-animating');
        }
      } else {
        panel.hidden = true;
        panel.classList.remove('is-animating');
      }
    });

    if (hint) hint.textContent = hints[state];
  }

  function playTransition() {
    if (autoPlayed || reduceMotion) {
      setState('now', !reduceMotion);
      return;
    }
    autoPlayed = true;
    stage.classList.add('is-transitioning');
    window.setTimeout(function () {
      setState('now', true);
      window.setTimeout(function () {
        stage.classList.remove('is-transitioning');
      }, 400);
    }, 1100);
  }

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      autoPlayed = true;
      stage.classList.remove('is-transitioning');
      setState(tab.getAttribute('data-vs'), true);
    });
  });

  // Start on Earlier, then morph to Now after a beat
  setState('earlier', true);
  if (reduceMotion) {
    setState('now', false);
  } else {
    window.setTimeout(playTransition, 1600);
  }
})();
