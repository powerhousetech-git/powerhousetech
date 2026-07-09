(function () {
  var PAGES = [
    { href: '/', label: 'Home', match: /^\/(index\.html)?$/ },
    { href: '/services.html', label: 'Services', match: /services/ },
    { href: '/how-we-work.html', label: 'How we work', match: /how-we-work/ },
    { href: '/sample-automations.html', label: 'Demos', match: /sample-automations/ },
    { href: '/industries.html', label: 'Industries', match: /industries/ },
    { href: '/about.html', label: 'About', match: /about/ },
    { href: '/contact.html', label: 'Contact', match: /contact/ }
  ];

  function currentPath() {
    var p = window.location.pathname;
    return p.endsWith('/') && p.length > 1 ? p.slice(0, -1) : p;
  }

  function isActive(page) {
    var path = currentPath();
    if (page.href === '/') return path === '' || path === '/' || path.endsWith('/index.html');
    var bare = page.href.replace(/\.html$/, '');
    return path === page.href || path === bare || path.endsWith(bare);
  }

  function navLink(page) {
    var cls = isActive(page) ? ' class="active"' : '';
    return '<a href="' + page.href + '"' + cls + '>' + page.label + '</a>';
  }

  window.phRenderNav = function (mount) {
    var el = document.getElementById(mount || 'ph-nav');
    if (!el) return;
    var onContact = /contact/.test(window.location.pathname);
    var desktop = PAGES.filter(function (p) { return p.href !== '/'; }).map(navLink).join('');
    var bookCta = onContact
      ? ''
      : '<a href="/contact.html#book" class="btn btn-primary nav-cta">Book a call</a>';
    el.innerHTML =
      '<header class="nav">' +
      '<div class="nav-inner">' +
      '<a href="/" class="brand" aria-label="Powerhouse home">' +
      '<svg width="28" height="28" aria-hidden="true"><use href="#logo-mark"/></svg>Powerhouse</a>' +
      '<nav class="nav-links" aria-label="Primary">' + desktop + '</nav>' +
      '<div class="nav-right">' +
      bookCta +
      '<button class="hamburger" id="hamburger" aria-label="Toggle menu" aria-expanded="false">☰</button>' +
      '</div></div>' +
      '<nav class="mobile-nav" id="mobile-nav" aria-label="Mobile">' +
      PAGES.map(navLink).join('') +
      '</nav></header>';
    phInitNav();
  };

  window.phRenderFooter = function (mount) {
    var el = document.getElementById(mount || 'ph-footer');
    if (!el) return;
    el.innerHTML =
      '<footer class="footer"><div class="container">' +
      '<div class="footer-grid">' +
      '<div class="footer-brand"><a href="/" class="brand" style="font-size:.95rem"><svg width="22" height="22"><use href="#logo-mark"/></svg> Powerhouse</a>' +
      '<p>An automation studio for global teams. We design, build and run the workflows behind your business.</p></div>' +
      '<nav class="footer-col"><h4>Company</h4><ul>' +
      '<li><a href="/services.html">Services</a></li><li><a href="/how-we-work.html">How we work</a></li>' +
      '<li><a href="/about.html">About</a></li></ul></nav>' +
      '<nav class="footer-col"><h4>Contact</h4><ul>' +
      '<li><a href="mailto:shreyas@powerhousetech.in">shreyas@powerhousetech.in</a></li>' +
      '<li><a href="mailto:yash@powerhousetech.in">yash@powerhousetech.in</a></li>' +
      '<li><a href="/contact.html">Contact page</a></li></ul></nav>' +
      '<nav class="footer-col"><h4>Legal</h4><ul>' +
      '<li><a href="/index.html?legal=terms">Terms</a></li><li><a href="/index.html?legal=privacy">Privacy</a></li></ul></nav>' +
      '</div><div class="footer-bottom"><span>© 2026 PowerhouseTech. All rights reserved.</span>' +
      '<span>Automation, delivered as a service.</span></div></div></footer>';
    var path = window.location.pathname;
    var onContact = /contact/.test(path);
    if (!onContact) {
      el.innerHTML += '<div class="mobile-cta"><a href="/contact.html#book" class="btn btn-primary">Book a call</a></div>';
    }
  };

  function loomEmbedId(url) {
    var m = url.match(/loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/);
    return m ? m[1] : null;
  }

  window.phRenderLoomDemos = function (mount) {
    var root = document.getElementById(mount || 'loom-demos');
    if (!root || !window.PH_SITE) return;
    root.innerHTML = window.PH_SITE.demos.map(function (d, i) {
      var id = loomEmbedId(d.loomUrl || '');
      var media = id
        ? '<div class="loom-embed-wrap"><iframe src="https://www.loom.com/embed/' + id + '" allowfullscreen title="' + d.title + '"></iframe></div>'
        : '<div class="loom-embed-wrap"><div class="loom-placeholder"><div class="play" aria-hidden="true"><svg width="28" height="28" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z"/></svg></div><p>Video walkthrough coming soon</p></div></div>';
      var bullets = d.bullets.map(function (b) { return '<li>' + b + '</li>'; }).join('');
      return '<article class="loom-card" id="' + d.id + '"><div class="loom-card-head">' +
        '<span class="badge">' + d.duration + '</span><h2>' + d.title + '</h2><p>' + d.summary + '</p><ul>' + bullets + '</ul></div>' +
        media +
        '<div class="loom-card-foot"><span class="loom-meta">Sample automation ' + (i + 1) + '</span></div></article>';
    }).join('');
  };

  window.phRenderContacts = function (mount) {
    var root = document.getElementById(mount || 'contact-cards');
    if (!root || !window.PH_SITE) return;
    root.innerHTML = window.PH_SITE.contacts.map(function (c) {
      return '<article class="contact-card"><h3>' + c.name + '</h3><p class="role">' + c.role + '</p>' +
        '<a class="contact-line" href="mailto:' + c.email + '">' + c.email + '</a>' +
        '<a class="contact-line" href="tel:' + c.phone + '">' + c.phoneDisplay + '</a></article>';
    }).join('');
  };

  window.phRenderCalendly = function (mount) {
    var root = document.getElementById(mount || 'calendly-slot');
    if (!root || !window.PH_SITE) return;
    var url = window.PH_SITE.calendlyUrl;
    root.innerHTML = url
      ? '<div class="calendly-inline-widget" data-url="' + url + '" style="min-width:320px;height:700px;"></div>'
      : '<div class="calendly-placeholder">Email <a href="mailto:shreyas@powerhousetech.in?subject=Discovery%20call">shreyas@powerhousetech.in</a> or call <a href="tel:+919119188492">+91 9119188492</a> to schedule.</div>';
    if (url && !document.getElementById('calendly-script')) {
      var s = document.createElement('script');
      s.id = 'calendly-script';
      s.src = 'https://assets.calendly.com/assets/external/widget.js';
      s.async = true;
      document.body.appendChild(s);
    }
  };

  function phInitNav() {
    var ham = document.getElementById('hamburger');
    var mob = document.getElementById('mobile-nav');
    if (!ham || !mob) return;
    ham.addEventListener('click', function () {
      var open = mob.classList.toggle('open');
      ham.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    phRenderNav();
    phRenderFooter();
    phRenderLoomDemos();
    phRenderContacts();
    phRenderCalendly();
    if (!document.getElementById('marketing-motion')) {
      var m = document.createElement('script');
      m.id = 'marketing-motion';
      m.src = '/js/marketing-motion.js';
      document.body.appendChild(m);
    }
  });
})();
