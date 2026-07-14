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
  var ringFg = document.getElementById('el-ring-fg');
  var dbCount = document.getElementById('el-db-count');
  var dbSeconds = document.getElementById('el-db-seconds');
  var dbLost = document.getElementById('el-db-lost');
  var dbDedupe = document.getElementById('el-db-dedupe');
  var dbTick = document.getElementById('el-db-tick');
  var ladderSteps = root.querySelectorAll('.el-ladder-step');
  var tlFill = document.getElementById('el-tl-fill');
  var tlPulse = document.getElementById('el-tl-pulse');
  var mailCompose = document.getElementById('el-mail-compose');
  var mailTo = document.getElementById('el-mail-to');
  var mailSubject = document.getElementById('el-mail-subject');
  var mailBody = document.getElementById('el-mail-body');
  var industryBtns = root.querySelectorAll('#el-industry-rail .el-ind');
  var flyouts = document.getElementById('el-flyouts');
  var sendBtn = document.getElementById('el-send-btn');
  var sentN = document.getElementById('el-sent-n');
  var zeroEl = document.getElementById('el-zero');

  var active = -1;
  var locked = false;
  var auto = true;
  var timer = null;
  var ladderTimer = null;
  var mailTimer = null;
  var typeTimers = [];
  var phaseCleanup = [];

  var PHASES = ['capture', 'read', 'database', 'mail', 'follow'];
  var DWELL = [4200, 4200, 4000, 4800, 4600];

  var CAPTIONS = [
    'Snap one card or dump a bulk stack of photos and PDFs — the intake hopper queues every one.',
    'A scan beam reads the card. Name, title, company, email, phone, and website fill in live.',
    'Contacts funnel into your database in a few seconds — de-duplicated, structured, ready.',
    'Mails fire customized to each client’s industry — electronics, auto, textiles, pharma…',
    'Day-0 → Day-3 → Day-7 keep going. Already contacted? Skipped. Zero leads lost.'
  ];

  var FIELD_VALUES = [
    'Priya Menon',
    'Procurement Lead',
    'Orbit PCB Exports',
    'priya@orbitpcb.com · +91…',
    'orbitpcb.com'
  ];

  var MAILS = [
    {
      to: 'Priya Menon · Orbit PCB Exports',
      subject: 'Great meeting you at Electronica — PCB supply',
      body: 'Hi Priya — following up from our booth conversation on your electronics line. Happy to share the spec sheet we mentioned…',
      fly: '✉ Electronics'
    },
    {
      to: 'James Okonkwo · Aether Auto',
      subject: 'Auto components follow-up from the floor',
      body: 'Hi James — picking up on machining tolerances we discussed. I can send the tolerance pack your buyer asked for…',
      fly: '✉ Auto'
    },
    {
      to: 'Neha Kapoor · Loom Textiles',
      subject: 'Textile sourcing — next steps after the show',
      body: 'Hi Neha — continuing from our chat on GSM and dye lots. Enclosed is the mill brief tailored to your range…',
      fly: '✉ Textiles'
    },
    {
      to: 'Marco Silva · PharmaVista',
      subject: 'Pharma packaging intro — as promised',
      body: 'Hi Marco — following the booth walkthrough on blister lines. Sending the validation checklist we offered…',
      fly: '✉ Pharma'
    }
  ];

  function later(fn, ms) {
    var id = window.setTimeout(fn, ms);
    phaseCleanup.push(id);
    return id;
  }

  function clearPhase() {
    phaseCleanup.forEach(function (id) { window.clearTimeout(id); });
    phaseCleanup = [];
    typeTimers.forEach(function (id) { window.clearTimeout(id); });
    typeTimers = [];
    if (ladderTimer) {
      window.clearInterval(ladderTimer);
      ladderTimer = null;
    }
    if (mailTimer) {
      window.clearInterval(mailTimer);
      mailTimer = null;
    }
    panels.forEach(function (p) { p.classList.remove('is-playing'); });
  }

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
    later(function () {
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
    if (isNaN(from)) from = 0;
    var t0 = performance.now();
    function tick(now) {
      var p = Math.min(1, (now - t0) / duration);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = String(Math.round(from + (to - from) * eased));
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function typeInto(el, text, speed, done) {
    if (!el) {
      if (done) done();
      return;
    }
    if (reduceMotion) {
      el.textContent = text;
      if (done) done();
      return;
    }
    el.textContent = '';
    var i = 0;
    function step() {
      el.textContent = text.slice(0, i);
      i += 1;
      if (i <= text.length) {
        typeTimers.push(window.setTimeout(step, speed));
      } else if (done) {
        done();
      }
    }
    step();
  }

  function playCapture(panel) {
    if (bulkCount) bulkCount.textContent = '0';
    if (ringFg) ringFg.classList.remove('is-full');
    panel.classList.add('is-playing');
    if (reduceMotion) {
      if (bulkCount) bulkCount.textContent = '48';
      if (ringFg) ringFg.classList.add('is-full');
      return;
    }
    animateCount(bulkCount, 48, 1600);
    later(function () {
      if (ringFg) ringFg.classList.add('is-full');
    }, 200);
  }

  function playRead(panel) {
    panel.classList.add('is-playing');
    var fields = root.querySelectorAll('#el-fields .el-field');
    fields.forEach(function (f) {
      f.classList.remove('is-in', 'is-lit', 'is-typing');
      var v = f.querySelector('[data-type]');
      if (v) v.textContent = '';
    });

    if (reduceMotion) {
      fields.forEach(function (f, i) {
        f.classList.add('is-in');
        var v = f.querySelector('[data-type]');
        if (v) v.textContent = FIELD_VALUES[i];
      });
      return;
    }

    fields.forEach(function (field, i) {
      later(function () {
        field.classList.add('is-in', 'is-lit', 'is-typing');
        var v = field.querySelector('[data-type]');
        typeInto(v, FIELD_VALUES[i], 28, function () {
          field.classList.remove('is-typing');
          later(function () { field.classList.remove('is-lit'); }, 400);
        });
      }, 280 + i * 420);
    });
  }

  function playDatabase(panel) {
    panel.classList.add('is-playing');
    var rows = root.querySelectorAll('#el-db-rows tr');
    rows.forEach(function (row) {
      row.classList.remove('is-enter');
      void row.offsetWidth;
    });
    if (dbCount) dbCount.textContent = '0';
    if (dbDedupe) dbDedupe.textContent = '0';
    if (dbLost) dbLost.textContent = '—';
    if (dbSeconds) dbSeconds.textContent = '0';
    if (dbTick) dbTick.textContent = 'Writing…';

    rows.forEach(function (row, i) {
      later(function () {
        row.classList.add('is-enter');
      }, reduceMotion ? 0 : 700 + i * 200);
    });

    animateCount(dbCount, 48, 1400);
    later(function () { animateCount(dbDedupe, 3, 600); }, 900);

    if (!reduceMotion && dbSeconds) {
      later(function () { dbSeconds.textContent = '1'; }, 450);
      later(function () { dbSeconds.textContent = '2'; }, 900);
      later(function () { dbSeconds.textContent = '3'; }, 1300);
    } else if (dbSeconds) {
      dbSeconds.textContent = '3';
    }

    later(function () {
      if (dbTick) dbTick.textContent = 'Synced in < 3s';
      if (dbLost) dbLost.textContent = '0';
    }, 1500);
  }

  function applyMail(index, fire) {
    var m = MAILS[index];
    if (!m) return;
    industryBtns.forEach(function (b, i) {
      b.classList.toggle('is-on', i === index);
    });
    if (!mailCompose) return;

    function paint() {
      if (mailTo) mailTo.textContent = m.to;
      if (mailSubject) mailSubject.textContent = m.subject;
      if (mailBody) {
        mailBody.innerHTML = m.body + '<span class="el-caret"></span>';
      }
      mailCompose.classList.remove('is-morph');
    }

    if (reduceMotion) {
      paint();
      return;
    }

    mailCompose.classList.add('is-morph');
    later(function () {
      paint();
      if (fire) fireMail(m.fly, index);
    }, 220);
  }

  function fireMail(label, index) {
    if (!flyouts || reduceMotion) return;
    var el = document.createElement('div');
    el.className = 'el-fly';
    el.textContent = label;
    var angle = (index / MAILS.length) * Math.PI - Math.PI / 2;
    el.style.setProperty('--dx', Math.round(Math.cos(angle) * 160 + 40) + 'px');
    el.style.setProperty('--dy', Math.round(Math.sin(angle) * 100 - 40) + 'px');
    flyouts.appendChild(el);
    void el.offsetWidth;
    el.classList.add('is-go');
    if (sendBtn) {
      sendBtn.classList.remove('is-fire');
      void sendBtn.offsetWidth;
      sendBtn.classList.add('is-fire');
    }
    if (mailCompose) {
      mailCompose.classList.add('is-sending');
      later(function () { mailCompose.classList.remove('is-sending'); }, 500);
    }
    if (sentN) {
      var n = (parseInt(sentN.textContent, 10) || 0) + 1;
      sentN.textContent = String(n);
    }
    later(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 1500);
  }

  function playMail(panel) {
    panel.classList.add('is-playing');
    if (flyouts) flyouts.innerHTML = '';
    if (sentN) sentN.textContent = '0';
    var idx = 0;
    applyMail(0, true);

    if (reduceMotion) return;

    mailTimer = window.setInterval(function () {
      idx = (idx + 1) % MAILS.length;
      applyMail(idx, true);
    }, 1100);
  }

  function playFollow(panel) {
    panel.classList.add('is-playing');
    ladderSteps.forEach(function (s) {
      s.classList.remove('is-live', 'is-done');
      var st = s.querySelector('.st');
      if (st) {
        var day = s.getAttribute('data-day');
        st.textContent = day === 'x' ? 'Guarded' : (day === '0' ? 'Pending' : 'Queued');
      }
    });
    if (tlFill) tlFill.style.height = '0%';
    if (tlPulse) {
      tlPulse.style.top = '0%';
      tlPulse.classList.remove('is-on');
    }
    if (zeroEl) {
      zeroEl.classList.remove('is-slam');
      zeroEl.textContent = '—';
    }

    if (reduceMotion) {
      ladderSteps.forEach(function (s, i) {
        s.classList.add(i < ladderSteps.length - 1 ? 'is-done' : 'is-live');
        var st = s.querySelector('.st');
        if (st) st.textContent = i < ladderSteps.length - 1 ? 'Sent' : 'Guarded';
      });
      if (tlFill) tlFill.style.height = '100%';
      if (zeroEl) zeroEl.textContent = '0';
      return;
    }

    later(function () {
      if (tlPulse) tlPulse.classList.add('is-on');
    }, 200);

    var i = 0;
    function advance() {
      ladderSteps.forEach(function (s, idx) {
        s.classList.toggle('is-done', idx < i);
        s.classList.toggle('is-live', idx === i);
        var st = s.querySelector('.st');
        if (!st) return;
        if (idx < i) st.textContent = s.getAttribute('data-day') === 'x' ? 'Guarded' : 'Sent';
        else if (idx === i) st.textContent = s.getAttribute('data-day') === 'x' ? 'Guarding…' : 'Sending…';
        else st.textContent = s.getAttribute('data-day') === 'x' ? 'Guarded' : 'Queued';
      });
      var pct = (i / Math.max(1, ladderSteps.length - 1)) * 100;
      if (tlFill) tlFill.style.height = pct + '%';
      if (tlPulse) tlPulse.style.top = pct + '%';
      i += 1;
      if (i >= ladderSteps.length) {
        window.clearInterval(ladderTimer);
        ladderTimer = null;
        ladderSteps.forEach(function (s) {
          s.classList.remove('is-live');
          s.classList.add('is-done');
          var st = s.querySelector('.st');
          if (st) st.textContent = s.getAttribute('data-day') === 'x' ? 'Guarded' : 'Sent';
        });
        if (tlFill) tlFill.style.height = '100%';
        if (tlPulse) tlPulse.style.top = '100%';
        if (zeroEl) {
          zeroEl.textContent = '0';
          zeroEl.classList.add('is-slam');
        }
      }
    }
    advance();
    ladderTimer = window.setInterval(advance, 950);
  }

  function applyState(index) {
    clearPhase();
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

    var panel = panels.filter(function (p) {
      return p.getAttribute('data-phase') === PHASES[index];
    })[0];
    if (!panel) return;

    later(function () {
      if (PHASES[index] === 'capture') playCapture(panel);
      if (PHASES[index] === 'read') playRead(panel);
      if (PHASES[index] === 'database') playDatabase(panel);
      if (PHASES[index] === 'mail') playMail(panel);
      if (PHASES[index] === 'follow') playFollow(panel);
    }, 80);
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
        }, 2400);
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

  industryBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      auto = false;
      if (mailTimer) {
        window.clearInterval(mailTimer);
        mailTimer = null;
      }
      var idx = parseInt(btn.getAttribute('data-ind'), 10) || 0;
      applyMail(idx, true);
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
  }
})();
