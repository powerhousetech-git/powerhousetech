(function () {
  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderDemo(d) {
    var bullets = (d.bullets || [])
      .map(function (b) {
        return '<li>' + esc(b) + '</li>';
      })
      .join('');
    var themeClass = d.theme === 'light' ? ' is-light' : '';
    var href = d.href || d.embed || '#';
    var embed = d.embed || href;
    var urlLabel = String(embed).replace(/^\//, 'powerhousetech.in/');

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
      '<a class="btn btn-primary" href="' +
      esc(href) +
      '">' +
      esc(d.cta || 'Open full screen') +
      '</a>' +
      '<a class="btn btn-ghost" href="/contact.html#book">Book a call</a>' +
      '</div></div>' +
      '<div class="demo-frame">' +
      '<div class="demo-chrome demo-chrome--desktop" aria-hidden="true">' +
      '<div class="demo-chrome-dots"><span></span><span></span><span></span></div>' +
      '<div class="demo-chrome-url">' +
      esc(urlLabel) +
      '</div></div>' +
      '<div class="demo-phone" aria-label="' +
      esc(d.title) +
      ' mobile preview">' +
      '<div class="demo-phone-bezel">' +
      '<div class="demo-phone-notch" aria-hidden="true"></div>' +
      '<div class="demo-frame-body' +
      themeClass +
      '">' +
      '<iframe src="' +
      esc(embed) +
      '" title="' +
      esc(d.title) +
      ' interactive demo" loading="lazy" referrerpolicy="same-origin"></iframe>' +
      '<div class="demo-frame-fallback" data-fallback>' +
      '<p>Preview didn’t load in this frame.</p>' +
      '<a class="btn btn-primary" href="' +
      esc(href) +
      '">Open full demo</a></div>' +
      '</div>' +
      '<div class="demo-phone-home" aria-hidden="true"></div>' +
      '</div>' +
      '<p class="demo-phone-caption">Mobile layout · scroll inside the phone</p>' +
      '</div></div></article>'
    );
  }

  window.phRenderProductDemos = function (mount) {
    var root = document.getElementById(mount || 'product-demos');
    if (!root || !window.PH_SITE) return;
    root.innerHTML = (window.PH_SITE.demos || []).map(renderDemo).join('');

    root.querySelectorAll('.demo-frame-body iframe').forEach(function (frame) {
      frame.addEventListener('error', function () {
        var fb = frame.parentElement && frame.parentElement.querySelector('[data-fallback]');
        if (fb) fb.classList.add('show');
      });
    });
  };

  window.phRenderLoomDemos = function () {
    window.phRenderProductDemos('product-demos');
    window.phRenderProductDemos('loom-demos');
  };

  document.addEventListener('DOMContentLoaded', function () {
    window.phRenderProductDemos();
  });
})();
