(() => {
  const USER_KEY = 'ph_user';
  const gate = () => window.phAuthGate;

  const authView = document.getElementById('auth-view');
  const servicesView = document.getElementById('services-view');
  const googleBtn = document.getElementById('google-signin');
  const demoBtn = document.getElementById('demo-signin');
  const signOutBtn = document.getElementById('signout-btn');
  const authError = document.getElementById('auth-error');
  const userChip = document.getElementById('user-chip');
  const userAvatar = document.getElementById('user-avatar');
  const userEmail = document.getElementById('user-email');
  const greetName = document.getElementById('greet-name');
  const adminLink = document.getElementById('admin-link');

  // Sample demos are public on /sample-automations — portal is for client / live access.
  if (demoBtn) {
    demoBtn.classList.add('hidden');
    demoBtn.style.display = 'none';
  }
  const demoDivider = document.getElementById('demo-divider');
  if (demoDivider) demoDivider.classList.add('hidden');
  const authHint = document.querySelector('.auth-hint');
  if (authHint) {
    authHint.innerHTML =
      '<b>Client sign-in.</b> Use the Google account on your Powerhouse invite for live Invoice Radar. Prefer a quick look? <a href="/sample-automations">Try the public demos</a>.';
  }

  function showError(msg) {
    if (!authError) return;
    authError.textContent = msg || '';
    authError.classList.toggle('hidden', !msg);
  }

  function showServices(user) {
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
    servicesView?.classList.add('hidden');
    authView?.classList.remove('hidden');
    signOutBtn?.classList.add('hidden');
    userChip?.classList.remove('show');
    adminLink?.classList.add('hidden');
  }

  async function afterSignIn(user, opts) {
    opts = opts || {};
    gate().writeUser(user);
    const session = await gate().recordSession('sign_in', '/portal', {
      display_name: user.displayName || '',
    });

    // Prefer explicit returnTo (from gated dashboard deep link)
    const params = new URLSearchParams(window.location.search);
    const qReturn = params.get('returnTo');
    if (qReturn) gate().setReturnTo(qReturn);

    const me = session || (await gate().fetchAdminMe());
    const isAdmin = Boolean(me && me.is_admin);

    if (adminLink) {
      adminLink.classList.toggle('hidden', !isAdmin);
    }

    // Default landing for admins (unless returning to a specific dashboard)
    const stored = gate().peekReturnTo();
    const hasExplicitReturn =
      stored && stored !== '/portal' && stored !== '/portal/';

    if (isAdmin && !hasExplicitReturn && !opts.stayOnPortal) {
      window.location.replace('/admin');
      return;
    }

    if (hasExplicitReturn && opts.followReturn !== false) {
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
      const result = await fb.signInWithPopup(fb.auth, fb.googleProvider);
      await afterSignIn(result.user);
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

  // Service cards → gated open
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

    const fb = await gate().waitForFirebase();
    if (!fb) {
      showAuth();
      return;
    }

    fb.onAuthStateChanged(fb.auth, async (user) => {
      if (user?.email) {
        await afterSignIn(user, { stayOnPortal: !qReturn, followReturn: Boolean(qReturn) });
      } else {
        // Clear stale demo sessions
        const cached = gate().readCachedUser();
        if (!cached) {
          try {
            sessionStorage.removeItem(USER_KEY);
            sessionStorage.removeItem('ph_portal_demo');
          } catch (_) {}
        }
        showAuth();
      }
    });
  }

  boot();
})();
