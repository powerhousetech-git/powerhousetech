/**
 * Shared Firebase auth gate for Powerhouse dashboards.
 * - requireAuth / guardPage: redirect unsigned users to /portal?returnTo=…
 * - safeReturnTo: allowlist relative paths only
 * - recordSession: upsert portal user + event via Edge Function
 * - Session: Firebase local persistence + localStorage cache so sign-in is once per browser session
 */
(function (global) {
  var USER_KEY = 'ph_user';
  var LOCAL_USER_KEY = 'ph_auth_user';
  var RETURN_KEY = 'ph_return_to';
  var DEMO_KEY = 'ph_portal_demo';
  var SUPABASE_URL = 'https://msratyvmnuvozuthgkmi.supabase.co';
  var SESSION_API = SUPABASE_URL + '/functions/v1/portal-session';
  var ADMIN_ME_API = SUPABASE_URL + '/functions/v1/admin-api?op=me';

  var authUserPromise = null;
  var cachedToken = null;
  var cachedTokenExp = 0;

  function waitForFirebase() {
    if (global.phFirebaseAuth) return Promise.resolve(global.phFirebaseAuth);
    return new Promise(function (resolve) {
      global.addEventListener(
        'ph-firebase-ready',
        function () {
          resolve(global.phFirebaseAuth);
        },
        { once: true }
      );
      setTimeout(function () {
        resolve(global.phFirebaseAuth || null);
      }, 10000);
    });
  }

  /** Wait for Firebase Auth to finish restoring from IndexedDB (not just SDK load). */
  function waitForAuthUser() {
    if (authUserPromise) return authUserPromise;
    authUserPromise = waitForFirebase().then(function (fb) {
      if (!fb || !fb.auth) return null;
      if (fb.auth.currentUser && fb.auth.currentUser.email) {
        return fb.auth.currentUser;
      }
      return new Promise(function (resolve) {
        var settled = false;
        var unsub = fb.onAuthStateChanged(fb.auth, function (user) {
          if (settled) return;
          settled = true;
          if (typeof unsub === 'function') unsub();
          resolve(user && user.email ? user : null);
        });
        setTimeout(function () {
          if (settled) return;
          settled = true;
          if (typeof unsub === 'function') unsub();
          var u = fb.auth.currentUser;
          resolve(u && u.email ? u : null);
        }, 8000);
      });
    });
    return authUserPromise;
  }

  /** Reset cached auth promise (e.g. after sign-out). */
  function resetAuthUserCache() {
    authUserPromise = null;
  }

  function safeReturnTo(path) {
    if (!path || typeof path !== 'string') return '/portal';
    var cleaned = path.trim();
    if (!cleaned.startsWith('/')) return '/portal';
    if (cleaned.startsWith('//') || cleaned.includes('://')) return '/portal';
    if (!/^\/[a-zA-Z0-9/_?=&%.+\-]*$/.test(cleaned)) return '/portal';
    return cleaned;
  }

  function setReturnTo(path) {
    try {
      sessionStorage.setItem(RETURN_KEY, safeReturnTo(path));
    } catch (_) {}
  }

  function consumeReturnTo(fallback) {
    try {
      var v = sessionStorage.getItem(RETURN_KEY);
      sessionStorage.removeItem(RETURN_KEY);
      return safeReturnTo(v || fallback || '/portal');
    } catch (_) {
      return safeReturnTo(fallback || '/portal');
    }
  }

  function peekReturnTo() {
    try {
      return safeReturnTo(sessionStorage.getItem(RETURN_KEY) || '');
    } catch (_) {
      return '/portal';
    }
  }

  function userPayload(user) {
    return {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || '',
      photoURL: user.photoURL || '',
      ts: Date.now(),
    };
  }

  function writeUser(user) {
    if (!user || !user.email) return;
    var payload = JSON.stringify(userPayload(user));
    try {
      sessionStorage.setItem(USER_KEY, payload);
      sessionStorage.removeItem(DEMO_KEY);
    } catch (_) {}
    try {
      localStorage.setItem(LOCAL_USER_KEY, payload);
    } catch (_) {}
    try {
      global.dispatchEvent(
        new CustomEvent('ph-auth-changed', { detail: { user: userPayload(user) } })
      );
    } catch (_) {}
  }

  function parseUser(raw) {
    try {
      if (!raw) return null;
      var u = JSON.parse(raw);
      if (!u || !u.email || u.uid === 'demo-portal') return null;
      return u;
    } catch (_) {
      return null;
    }
  }

  function readCachedUser() {
    try {
      var fromSession = parseUser(sessionStorage.getItem(USER_KEY));
      if (fromSession) return fromSession;
    } catch (_) {}
    try {
      return parseUser(localStorage.getItem(LOCAL_USER_KEY));
    } catch (_) {
      return null;
    }
  }

  function clearUser() {
    try {
      sessionStorage.removeItem(USER_KEY);
      sessionStorage.removeItem(DEMO_KEY);
    } catch (_) {}
    try {
      localStorage.removeItem(LOCAL_USER_KEY);
    } catch (_) {}
    cachedToken = null;
    cachedTokenExp = 0;
    resetAuthUserCache();
    try {
      global.dispatchEvent(new CustomEvent('ph-auth-changed', { detail: { user: null } }));
    } catch (_) {}
  }

  function portalSignInUrl(returnTo) {
    var rt = safeReturnTo(returnTo || global.location.pathname + global.location.search);
    setReturnTo(rt);
    return '/portal?returnTo=' + encodeURIComponent(rt);
  }

  async function getIdToken(force) {
    var user = await waitForAuthUser();
    if (!user) {
      cachedToken = null;
      cachedTokenExp = 0;
      return null;
    }
    var now = Date.now();
    if (!force && cachedToken && now < cachedTokenExp) return cachedToken;
    cachedToken = await user.getIdToken(!!force);
    // Refresh a bit before the typical 1h expiry.
    cachedTokenExp = now + 50 * 60 * 1000;
    return cachedToken;
  }

  async function recordSession(eventType, path, meta) {
    try {
      var token = await getIdToken();
      if (!token) return null;
      var res = await fetch(SESSION_API, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event_type: eventType || 'session',
          path: path || global.location.pathname,
          meta: meta || {},
        }),
      });
      if (!res.ok) return null;
      return res.json();
    } catch (err) {
      console.warn('portal-session failed', err);
      return null;
    }
  }

  async function fetchAdminMe() {
    try {
      var token = await getIdToken();
      if (!token) return { is_admin: false };
      var res = await fetch(ADMIN_ME_API, {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (!res.ok) return { is_admin: false };
      return res.json();
    } catch (_) {
      return { is_admin: false };
    }
  }

  /**
   * If signed in, resolve with Firebase user. Otherwise redirect to portal.
   */
  async function guardPage(opts) {
    opts = opts || {};
    var returnTo = safeReturnTo(
      opts.returnTo || global.location.pathname + global.location.search
    );
    var fb = await waitForFirebase();
    if (!fb || !fb.auth) {
      global.location.replace(portalSignInUrl(returnTo));
      return null;
    }

    var user = await waitForAuthUser();
    if (user && user.email) {
      writeUser(user);
      if (opts.record !== false) {
        recordSession(opts.eventType || 'dashboard_view', returnTo, {
          title: opts.title || document.title,
        });
      }
      return user;
    }
    clearUser();
    global.location.replace(portalSignInUrl(returnTo));
    return null;
  }

  /** Navigate to a URL; only redirect to sign-in if truly signed out. */
  async function openGated(href) {
    var target = safeReturnTo(href);
    var user = await waitForAuthUser();
    if (user && user.email) {
      writeUser(user);
      recordSession('demo_open', target, {});
      global.location.href = target;
      return;
    }
    // Public demos never need a gate — open directly.
    if (
      /^\/(demo\/|invoice-dashboard\/?|sample-automations)/.test(target) ||
      target.indexOf('/demos/') === 0
    ) {
      global.location.href = target;
      return;
    }
    global.location.href = portalSignInUrl(target);
  }

  /** Update marketing / home Sign in → Portal when session exists. */
  function applyNavSession(user) {
    var label = user && user.email ? 'Portal' : 'Sign in';
    var title = user && user.email ? 'Open your portal' : 'Sign in';
    document.querySelectorAll('[data-auth-cta], a.nav-cta[href="/portal"], a.mobile-signin[href="/portal"]').forEach(
      function (el) {
        if (el.tagName === 'A' && (el.getAttribute('href') || '').indexOf('/portal') === 0) {
          el.textContent = label;
          el.setAttribute('title', title);
          if (user && user.email) el.setAttribute('data-signed-in', '1');
          else el.removeAttribute('data-signed-in');
        }
      }
    );
    document.querySelectorAll('[data-auth-cta]').forEach(function (el) {
      el.textContent = label;
    });
  }

  function bootNavSession() {
    applyNavSession(readCachedUser());
    waitForAuthUser().then(function (user) {
      if (user) {
        writeUser(user);
        applyNavSession(userPayload(user));
      } else {
        clearUser();
        applyNavSession(null);
      }
    });
    global.addEventListener('ph-auth-changed', function (ev) {
      applyNavSession(ev.detail && ev.detail.user);
    });
  }

  global.phAuthGate = {
    waitForFirebase: waitForFirebase,
    waitForAuthUser: waitForAuthUser,
    resetAuthUserCache: resetAuthUserCache,
    safeReturnTo: safeReturnTo,
    setReturnTo: setReturnTo,
    consumeReturnTo: consumeReturnTo,
    peekReturnTo: peekReturnTo,
    writeUser: writeUser,
    readCachedUser: readCachedUser,
    clearUser: clearUser,
    portalSignInUrl: portalSignInUrl,
    getIdToken: getIdToken,
    recordSession: recordSession,
    fetchAdminMe: fetchAdminMe,
    guardPage: guardPage,
    openGated: openGated,
    applyNavSession: applyNavSession,
    bootNavSession: bootNavSession,
    USER_KEY: USER_KEY,
    LOCAL_USER_KEY: LOCAL_USER_KEY,
    RETURN_KEY: RETURN_KEY,
  };
})(window);
