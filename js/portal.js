(() => {
  const gate = () => window.phAuthGate;

  const authView = document.getElementById('auth-view');
  const servicesView = document.getElementById('services-view');
  const restoringView = document.getElementById('restoring-view');
  const googleBtn = document.getElementById('google-signin');
  const demoBtn = document.getElementById('demo-signin');
  const signOutBtn = document.getElementById('signout-btn');
  const authError = document.getElementById('auth-error');
  const userChip = document.getElementById('user-chip');
  const userAvatar = document.getElementById('user-avatar');
  const userEmail = document.getElementById('user-email');
  const greetName = document.getElementById('greet-name');
  const adminLink = document.getElementById('admin-link');

  let handledUid = null;
  let bootDone = false;

  // Public demos don't need the portal — keep sign-in focused.
  if (demoBtn) {
    demoBtn.classList.add('hidden');
    demoBtn.style.display = 'none';
  }
  const demoDivider = document.getElementById('demo-divider');
  if (demoDivider) demoDivider.classList.add('hidden');
  const authHint = document.querySelector('.auth-hint');
  if (authHint) {
    authHint.innerHTML =
      'Prefer browsing first? <a href="/sample-automations">Open the public demos</a> — no sign-in required.';
  }

  function showError(msg) {
    if (!authError) return;
    authError.textContent = msg || '';
    authError.classList.toggle('hidden', !msg);
  }

  function showRestoring() {
    restoringView?.classList.remove('hidden');
    authView?.classList.add('hidden');
    servicesView?.classList.add('hidden');
    signOutBtn?.classList.add('hidden');
  }

  function showServices(user) {
    restoringView?.classList.add('hidden');
    authView?.classList.add('hidden');
    servicesView?.classList.remove('hidden');
    signOutBtn?.classList.remove('hidden');

    const name =
      user?.displayName?.split(' ')[0] ||
      user?.email?.split('@')[0] ||
      'there';
    if (greetName) greetName.textContent = name;

    if (userChip && userAvatar && userEmail) {
      userChip.classList.add('show');
      const label = user?.email || 'Signed in';
      userEmail.textContent = label;
      userAvatar.textContent = (label[0] || 'P').toUpperCase();
    }
  }

  function showAuth() {
    restoringView?.classList.add('hidden');
    servicesView?.classList.add('hidden');
    authView?.classList.remove('hidden');
    signOutBtn?.classList.add('hidden');
    userChip?.classList.remove('show');
    adminLink?.classList.add('hidden');
  }

  async function afterSignIn(user, opts) {
    opts = opts || {};
    if (!user?.email) {
      showAuth();
      return;
    }

    // Avoid double-handling the same restored session (popup + onAuthStateChanged).
    if (handledUid === user.uid && opts.skipIfHandled) {
      showServices({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
      });
      return;
    }
    handledUid = user.uid;

    gate().writeUser(user);

    let session = null;
    if (opts.record !== false) {
      session = await gate().recordSession(opts.eventType || 'sign_in', '/portal', {
        display_name: user.displayName || '',
      });
    }

    const params = new URLSearchParams(window.location.search);
    const qReturn = params.get('returnTo');
    if (qReturn) gate().setReturnTo(qReturn);

    const me = session || (await gate().fetchAdminMe());
    const isAdmin = Boolean(me && me.is_admin);

    if (adminLink) {
      adminLink.classList.toggle('hidden', !isAdmin);
    }

    const stored = gate().peekReturnTo();
    const hasExplicitReturn =
      stored && stored !== '/portal' && stored !== '/portal/';

    // Fresh Google popup: admins land on /admin unless they had a returnTo.
    if (isAdmin && !hasExplicitReturn && opts.preferAdmin) {
      window.location.replace('/admin');
      return;
    }

    if (hasExplicitReturn && opts.followReturn) {
      const dest = gate().consumeReturnTo('/portal');
      if (dest !== '/portal' && dest !== window.location.pathname) {
        window.location.replace(dest);
        return;
      }
    }

    showServices({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
    });
  }

  async function signInGoogle() {
    showError('');
    googleBtn.disabled = true;
    try {
      const fb = await gate().waitForFirebase();
      if (!fb) throw new Error('Authentication is still loading. Try again.');
      gate().resetAuthUserCache();
      const result = await fb.signInWithPopup(fb.auth, fb.googleProvider);
      await afterSignIn(result.user, {
        preferAdmin: true,
        followReturn: true,
        eventType: 'sign_in',
      });
    } catch (err) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        console.error(err);
        showError(err?.message || 'Sign-in failed. Please try again.');
      }
    } finally {
      googleBtn.disabled = false;
    }
  }

  async function signOut() {
    handledUid = null;
    gate().clearUser();
    try {
      const fb = await gate().waitForFirebase();
      if (fb?.auth?.currentUser) await fb.signOut(fb.auth);
    } catch (err) {
      console.error(err);
    }
    showAuth();
  }

  googleBtn?.addEventListener('click', signInGoogle);
  signOutBtn?.addEventListener('click', signOut);

  // Service cards → gated open (live products only; demos are public hrefs)
  document.querySelectorAll('[data-gated-href]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const href = el.getAttribute('data-gated-href');
      if (href) gate().openGated(href);
    });
  });

  async function boot() {
    const params = new URLSearchParams(window.location.search);
    const qReturn = params.get('returnTo');
    if (qReturn) gate().setReturnTo(qReturn);

    const cached = gate().readCachedUser();
    if (cached) {
      // Optimistic: don't flash the Google button if we already signed in this browser.
      showServices(cached);
    } else {
      showRestoring();
    }

    const user = await gate().waitForAuthUser();
    bootDone = true;

    if (user?.email) {
      await afterSignIn(user, {
        preferAdmin: false,
        followReturn: Boolean(qReturn),
        eventType: 'session_restore',
        record: true,
        skipIfHandled: false,
      });
      return;
    }

    gate().clearUser();
    handledUid = null;
    showAuth();
  }

  boot().catch((err) => {
    console.error(err);
    if (!bootDone) showAuth();
  });
})();
