/**
 * Shared Firebase auth gate for Powerhouse dashboards.
 * - requireAuth / guardPage: redirect unsigned users to /portal?returnTo=…
 * - safeReturnTo: allowlist relative paths only
 * - recordSession: upsert portal user + event via Edge Function
 */
(function (global) {
  var USER_KEY = 'ph_user';
  var RETURN_KEY = 'ph_return_to';
  var DEMO_KEY = 'ph_portal_demo';
  var SUPABASE_URL = 'https://msratyvmnuvozuthgkmi.supabase.co';
  var SESSION_API = SUPABASE_URL + '/functions/v1/portal-session';
  var ADMIN_ME_API = SUPABASE_URL + '/functions/v1/admin-api?op=me';

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

  function writeUser(user) {
    try {
      sessionStorage.setItem(
        USER_KEY,
        JSON.stringify({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || '',
          photoURL: user.photoURL || '',
        })
      );
      sessionStorage.removeItem(DEMO_KEY);
    } catch (_) {}
  }

  function readCachedUser() {
    try {
      var raw = sessionStorage.getItem(USER_KEY);
      if (!raw) return null;
      var u = JSON.parse(raw);
      if (!u || !u.email || u.uid === 'demo-portal') return null;
      return u;
    } catch (_) {
      return null;
    }
  }

  function clearUser() {
    try {
      sessionStorage.removeItem(USER_KEY);
      sessionStorage.removeItem(DEMO_KEY);
    } catch (_) {}
  }

  function portalSignInUrl(returnTo) {
    var rt = safeReturnTo(returnTo || global.location.pathname + global.location.search);
    setReturnTo(rt);
    return '/portal?returnTo=' + encodeURIComponent(rt);
  }

  async function getIdToken() {
    var fb = await waitForFirebase();
    var user = fb && fb.auth && fb.auth.currentUser;
    if (!user) return null;
    return user.getIdToken();
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

    return new Promise(function (resolve) {
      var unsub = fb.onAuthStateChanged(fb.auth, function (user) {
        if (typeof unsub === 'function') unsub();
        if (user && user.email) {
          writeUser(user);
          resolve(user);
          if (opts.record !== false) {
            recordSession(opts.eventType || 'dashboard_view', returnTo, {
              title: opts.title || document.title,
            });
          }
        } else {
          clearUser();
          global.location.replace(portalSignInUrl(returnTo));
          resolve(null);
        }
      });
    });
  }

  /** Navigate to a gated URL (or portal sign-in with returnTo). */
  async function openGated(href) {
    var target = safeReturnTo(href);
    var fb = await waitForFirebase();
    var user = fb && fb.auth && fb.auth.currentUser;
    if (user && user.email) {
      writeUser(user);
      recordSession('demo_open', target, {});
      global.location.href = target;
      return;
    }
    global.location.href = portalSignInUrl(target);
  }

  global.phAuthGate = {
    waitForFirebase: waitForFirebase,
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
    USER_KEY: USER_KEY,
    RETURN_KEY: RETURN_KEY,
  };
})(window);
