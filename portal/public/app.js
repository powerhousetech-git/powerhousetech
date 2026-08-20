(() => {
  const MAIN_SITE = 'https://powerhousetech.in';
  const STATUSES = [
    'Queue',
    'Email Found',
    'Day1 Sent',
    'Day4 Sent',
    'Day9 Sent',
    'Replied',
    'Bounced',
    'Unsubscribed',
  ];
  const TRACKS = ['Track A - Startups', 'Track B - EMS'];

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function statusClass(status) {
    return 's-' + String(status || '').replace(/\s+/g, '-');
  }

  function badge(status) {
    return `<span class="badge ${statusClass(status)}">${esc(status)}</span>`;
  }

  function fmt(ts) {
    if (!ts) return '—';
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return ts;
    }
  }

  async function waitFirebase() {
    if (window.phFirebaseAuth) return window.phFirebaseAuth;
    return new Promise((resolve) => {
      window.addEventListener('ph-firebase-ready', () => resolve(window.phFirebaseAuth), {
        once: true,
      });
      setTimeout(() => resolve(window.phFirebaseAuth || null), 8000);
    });
  }

  async function getIdToken(force) {
    const fb = await waitFirebase();
    const user = fb?.auth?.currentUser;
    if (!user) return null;
    return user.getIdToken(!!force);
  }

  async function api(path, opts) {
    opts = opts || {};
    const token = await getIdToken();
    if (!token) throw new Error('Sign in required');
    const res = await fetch(path, {
      method: opts.method || 'GET',
      headers: {
        Authorization: 'Bearer ' + token,
        ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  async function fetchAdminMe(token) {
    try {
      const res = await fetch(
        'https://msratyvmnuvozuthgkmi.supabase.co/functions/v1/admin-api?op=me',
        { headers: { Authorization: 'Bearer ' + token } },
      );
      if (!res.ok) return { is_admin: false };
      return res.json();
    } catch {
      return { is_admin: false };
    }
  }

  async function signInWithGoogle() {
    const fb = await waitFirebase();
    if (!fb) throw new Error('Firebase not ready');
    const result = await fb.signInWithPopup(fb.auth, fb.googleProvider);
    return result.user;
  }

  async function requireAdminShell() {
    const gateEl = document.getElementById('admin-gate');
    const shellEl = document.getElementById('admin-shell');
    const gateMsg = document.getElementById('gate-msg');

    const fb = await waitFirebase();
    if (!fb?.auth) {
      gateMsg.textContent = 'Could not load auth. Refresh and try again.';
      return null;
    }

    // Wait for restored session
    let user = await new Promise((resolve) => {
      let done = false;
      const unsub = fb.onAuthStateChanged(fb.auth, (u) => {
        if (done) return;
        done = true;
        if (typeof unsub === 'function') unsub();
        resolve(u && u.email ? u : null);
      });
      setTimeout(() => {
        if (done) return;
        done = true;
        if (typeof unsub === 'function') unsub();
        const u = fb.auth.currentUser;
        resolve(u && u.email ? u : null);
      }, 6000);
    });

    if (!user) {
      gateMsg.textContent = 'Admin Google sign-in required for the outreach portal.';
      gateEl.classList.remove('hidden');
      shellEl.classList.add('hidden');

      // Wire / create sign-in button for popup on this origin
      let btn = document.getElementById('google-signin-btn');
      if (!btn) {
        btn = document.createElement('button');
        btn.id = 'google-signin-btn';
        btn.type = 'button';
        btn.className = 'btn btn-primary';
        btn.textContent = 'Sign in with Google';
        btn.style.marginTop = '16px';
        gateEl.querySelector('.gate-card')?.appendChild(btn);
      }
      btn.onclick = async () => {
        try {
          btn.disabled = true;
          gateMsg.textContent = 'Opening Google…';
          user = await signInWithGoogle();
          location.reload();
        } catch (err) {
          gateMsg.textContent = err.message || 'Sign-in failed';
          btn.disabled = false;
        }
      };
      return null;
    }

    const token = await user.getIdToken();
    const me = await fetchAdminMe(token);
    const fallbackAdmin =
      String(user.email || '').toLowerCase() === 'shreyas@powerhousetech.in';
    if (!me.is_admin && !fallbackAdmin) {
      gateMsg.textContent =
        'This Google account is not an admin. Contact shreyas@powerhousetech.in.';
      gateEl.classList.remove('hidden');
      shellEl.classList.add('hidden');
      return null;
    }

    gateEl.classList.add('hidden');
    shellEl.classList.remove('hidden');
    const emailEl = document.getElementById('admin-email');
    if (emailEl) emailEl.textContent = me.email || user.email;

    document.getElementById('admin-signout')?.addEventListener('click', async () => {
      await fb.signOut(fb.auth);
      location.reload();
    });

    return { email: me.email || user.email, is_admin: true };
  }

  function navActive(id) {
    document.querySelectorAll('[data-nav]').forEach((el) => {
      el.classList.toggle('active', el.getAttribute('data-nav') === id);
    });
  }

  window.OutreachUI = {
    MAIN_SITE,
    STATUSES,
    TRACKS,
    esc,
    badge,
    fmt,
    api,
    requireAdminShell,
    navActive,
  };
})();
