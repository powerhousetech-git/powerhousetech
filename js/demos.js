(function () {
  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function staticLivePreview() {
    return (
      '<div class="demo-static-preview" aria-hidden="true">' +
      '<div class="rail">' +
      '<div class="brand">Invoice Radar</div>' +
      '<span class="on">Dashboard</span><span>Receivables</span><span>Approvals</span><span>Follow-ups</span>' +
      '</div>' +
      '<div class="stage">' +
      '<div class="kpis">' +
      '<div class="kpi"><small>Open AR</small><b>₹4.2L</b></div>' +
      '<div class="kpi"><small>Due soon</small><b>12</b></div>' +
      '<div class="kpi"><small>Awaiting approval</small><b>5</b></div>' +
      '</div>' +
      '<div class="panel">' +
      '<div class="bars"><i></i><i></i><i></i><i></i><i></i><i></i></div>' +
      '<p>Your live sheet powers this view after entitlement. Sign in with the invited Google account.</p>' +
      '</div></div></div>'
    );
  }

  function renderDemo(d) {
    var bullets = (d.bullets || [])
      .map(function (b) {
        return '<li>' + esc(b) + '</li>';
      })
      .join('');
    var isPublic = d.access !== 'gated' && d.embed;
    var themeClass = d.theme === 'light' ? ' is-light' : '';
    var urlLabel = (d.embed || d.href || '').replace(/^\//, 'powerhousetech.in/');

    var mediaBody;
    if (isPublic) {
      mediaBody =
        '<iframe src="' +
        esc(d.embed) +
        '" title="' +
        esc(d.title) +
        ' interactive demo" loading="lazy" referrerpolicy="same-origin"></iframe>' +
        '<div class="demo-frame-fallback" data-fallback>' +
        '<p>Preview didn’t load in this browser frame.</p>' +
        '<a class="btn btn-primary" href="' +
        esc(d.href) +
        '">Open full demo</a></div>';
    } else {
      mediaBody = staticLivePreview();
    }

    var primaryCta;
    if (isPublic) {
      primaryCta =
        '<a class="btn btn-primary" href="' + esc(d.href) + '">' + esc(d.cta || 'Open full screen') + '</a>';
    } else {
      primaryCta =
        '<button type="button" class="btn btn-primary" data-gated-href="' +
        esc(d.href) +
        '">' +
        esc(d.cta || 'Sign in to open') +
        '</button>';
    }

    return (
      '<article class="demo-product reveal" id="' +
      esc(d.id) +
      '">' +
      '<div class="demo-product-head">' +
      '<div>' +
      '<span class="badge">' +
      esc(d.badge || 'Demo') +
      '</span>' +
      '<h2>' +
      esc(d.title) +
      '</h2>' +
      '<p class="product-line">' +
      esc(d.product || '') +
      '</p>' +
      '<p class="summary">' +
      esc(d.summary) +
      '</p>' +
      '<ul>' +
      bullets +
      '</ul></div>' +
      '<div class="demo-product-actions">' +
      primaryCta +
      '<a class="btn btn-ghost" href="/contact.html#book">Book a call</a>' +
      '</div></div>' +
      '<div class="demo-frame">' +
      '<div class="demo-chrome">' +
      '<div class="demo-chrome-dots" aria-hidden="true"><span></span><span></span><span></span></div>' +
      '<div class="demo-chrome-url">' +
      esc(urlLabel) +
      '</div></div>' +
      '<div class="demo-frame-body' +
      themeClass +
      '">' +
      mediaBody +
      '</div></div></article>'
    );
  }

  window.phRenderProductDemos = function (mount) {
    var root = document.getElementById(mount || 'product-demos');
    if (!root || !window.PH_SITE) return;
    root.innerHTML = (window.PH_SITE.demos || []).map(renderDemo).join('');

    root.querySelectorAll('[data-gated-href]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var target = btn.getAttribute('data-gated-href');
        if (!target) return;
        if (window.phAuthGate) {
          window.phAuthGate.openGated(target);
        } else {
          window.location.href = '/portal?returnTo=' + encodeURIComponent(target);
        }
      });
    });

    // If an iframe hard-fails, surface the fallback (rare on same-origin).
    root.querySelectorAll('.demo-frame-body iframe').forEach(function (frame) {
      frame.addEventListener('error', function () {
        var fb = frame.parentElement && frame.parentElement.querySelector('[data-fallback]');
        if (fb) fb.classList.add('show');
      });
    });
  };

  // Keep old name as alias so marketing.js init stays harmless.
  window.phRenderLoomDemos = function () {
    window.phRenderProductDemos('product-demos');
    window.phRenderProductDemos('loom-demos');
  };

  document.addEventListener('DOMContentLoaded', function () {
    window.phRenderProductDemos();
  });
})();
