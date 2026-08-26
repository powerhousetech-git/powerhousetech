(() => {
  const MAIN_SITE = 'https://powerhousetech.in';
  const STATUSES = [
    'Queue',
    'Email Found',
    'Follow1 Sent',
    'Follow2 Sent',
    'Follow3 Sent',
    'Follow4 Sent',
    'Follow5 Sent',
    'Follow6 Sent',
    'Follow7 Sent',
    'Follow8 Sent',
    'Follow9 Sent',
    'Follow10 Sent',
    'Replied',
    'Bounced',
    'Unsubscribed',
  ];
  const FOLLOW_STATUSES = STATUSES.filter((s) => s.startsWith('Follow'));
  const TRACKS = ['Track A - Startups', 'Track B - EMS'];
  const INDUSTRY_COLORS = [
    '#6366f1',
    '#3b82f6',
    '#22c55e',
    '#eab308',
    '#f97316',
    '#ef4444',
    '#a855f7',
    '#14b8a6',
    '#ec4899',
    '#6b7280',
  ];

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function statusClass(status) {
    const s = String(status || '');
    if (/^Follow([4-9]|10) Sent$/.test(s)) return 's-FollowN-Sent';
    return 's-' + s.replace(/\s+/g, '-');
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

  function relativeTime(iso) {
    if (!iso) return '—';
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return fmt(iso);
    const diff = Date.now() - t;
    const mins = Math.round(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + ' min' + (mins === 1 ? '' : 's') + ' ago';
    const hrs = Math.round(mins / 60);
    if (hrs < 48) return hrs + ' hour' + (hrs === 1 ? '' : 's') + ' ago';
    const days = Math.round(hrs / 24);
    if (days < 14) return days + ' day' + (days === 1 ? '' : 's') + ' ago';
    return fmt(iso);
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

    return { email: me.email || user.email, is_admin: true };
  }

  function navActive(id) {
    document.querySelectorAll('[data-nav]').forEach((el) => {
      el.classList.toggle('active', el.getAttribute('data-nav') === id);
    });
  }

  // ---- Industries -----------------------------------------------------

  async function loadIndustries(opts) {
    const params = new URLSearchParams();
    if (opts && opts.includeArchived) params.set('includeArchived', '1');
    const qs = params.toString();
    try {
      const data = await api('/api/industries' + (qs ? '?' + qs : ''));
      if (Array.isArray(data)) return data;
      if (Array.isArray(data?.industries)) return data.industries;
      return [];
    } catch {
      return [];
    }
  }

  function industryColor(ind) {
    return (ind && ind.color) || '#6b7280';
  }

  // ---- Modal helper -----------------------------------------------------

  function ensureModalRoot() {
    let root = document.getElementById('ui-modal-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'ui-modal-root';
      document.body.appendChild(root);
    }
    return root;
  }

  function closeModal() {
    const root = document.getElementById('ui-modal-root');
    if (root) root.innerHTML = '';
  }

  function openModal(innerHtml) {
    const root = ensureModalRoot();
    root.innerHTML = `
      <div class="modal-overlay" id="ui-modal-overlay">
        <div class="modal-card" role="dialog">${innerHtml}</div>
      </div>
    `;
    const overlay = document.getElementById('ui-modal-overlay');
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
    document.querySelectorAll('[data-modal-close]').forEach((el) => {
      el.addEventListener('click', () => closeModal());
    });
    return root.querySelector('.modal-card');
  }

  // ---- Add industry modal ------------------------------------------------

  function openAddIndustryModal() {
    const card = openModal(`
      <div class="modal-header">
        <h2>Add industry</h2>
        <button type="button" class="modal-x" data-modal-close aria-label="Close">×</button>
      </div>
      <div class="modal-body">
        <label class="modal-label" for="ai-name">Name</label>
        <input id="ai-name" type="text" placeholder="e.g. Dental Clinics" maxlength="80">

        <label class="modal-label" for="ai-desc">Description (optional)</label>
        <textarea id="ai-desc" rows="2" placeholder="Short description shown on the industry page"></textarea>

        <label class="modal-label">Color</label>
        <div class="color-swatches" id="ai-swatches">
          ${INDUSTRY_COLORS.map(
            (c, i) =>
              `<button type="button" class="color-swatch${i === 0 ? ' active' : ''}" data-color="${c}" style="background:${c}" aria-label="${c}"></button>`,
          ).join('')}
        </div>
        <p class="muted" id="ai-error" style="display:none;color:#f87171"></p>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn" data-modal-close>Cancel</button>
        <button type="button" class="btn btn-primary" id="ai-submit">Create industry</button>
      </div>
    `);

    let selectedColor = INDUSTRY_COLORS[0];
    card.querySelectorAll('.color-swatch').forEach((sw) => {
      sw.addEventListener('click', () => {
        card.querySelectorAll('.color-swatch').forEach((s) => s.classList.remove('active'));
        sw.classList.add('active');
        selectedColor = sw.getAttribute('data-color');
      });
    });

    const errEl = card.querySelector('#ai-error');
    const submitBtn = card.querySelector('#ai-submit');
    submitBtn.addEventListener('click', async () => {
      const name = card.querySelector('#ai-name').value.trim();
      const description = card.querySelector('#ai-desc').value.trim();
      errEl.style.display = 'none';
      if (name.length < 2 || name.length > 80) {
        errEl.textContent = 'Name must be 2–80 characters.';
        errEl.style.display = '';
        return;
      }
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating…';
      try {
        const created = await api('/api/industries', {
          method: 'POST',
          body: { name, description: description || undefined, color: selectedColor },
        });
        const slug = created?.slug || created?.industry?.slug;
        closeModal();
        if (slug) {
          location.href = '/industry/' + encodeURIComponent(slug) + '?tab=templates';
        } else {
          location.reload();
        }
      } catch (err) {
        errEl.textContent = err.message || 'Failed to create industry';
        errEl.style.display = '';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create industry';
      }
    });

    card.querySelector('#ai-name').focus();
  }

  // ---- Shared sidebar ----------------------------------------------------

  async function renderIndustrySidebar(active, email) {
    const nav = document.getElementById('side-nav');
    if (!nav) return;

    nav.innerHTML = `
      <div class="brand">Outreach</div>
      <a data-nav="dashboard" href="/">Dashboard</a>
      <div class="nav-label">Industries</div>
      <div class="nav-industries" id="nav-industries-list">
        <div class="nav-loading muted">Loading…</div>
      </div>
      <button type="button" class="nav-add-btn" id="nav-add-industry-btn">+ Add Industry</button>
      <div class="nav-sep"></div>
      <a data-nav="controls" href="/controls">Controls</a>
      <a data-nav="stats" href="/stats">Stats</a>
      <div class="nav-bottom">
        <p class="nav-settings-note muted">Cadence &amp; templates now live per-industry — see Controls for global defaults.</p>
        <div id="admin-email" class="muted">${esc(email || '')}</div>
        <button type="button" id="admin-signout" style="margin-top:8px;width:100%">Sign out</button>
        <a class="btn" href="https://powerhousetech.in/admin" style="margin-top:8px;width:100%;justify-content:center">← Admin</a>
      </div>
    `;

    navActive(active === 'dashboard' || active === 'controls' || active === 'stats' ? active : '');

    document.getElementById('admin-signout')?.addEventListener('click', async () => {
      const fb = await waitFirebase();
      if (fb?.auth) await fb.signOut(fb.auth);
      location.reload();
    });

    document.getElementById('nav-add-industry-btn')?.addEventListener('click', () => {
      openAddIndustryModal();
    });

    const list = await loadIndustries({ includeArchived: true });
    const industriesEl = document.getElementById('nav-industries-list');
    if (!industriesEl) return;
    if (!list.length) {
      industriesEl.innerHTML = '<div class="nav-empty muted">No industries yet</div>';
      return;
    }
    industriesEl.innerHTML = list
      .map((ind) => {
        const isActive = active === 'industry:' + ind.slug;
        const archived = !!ind.isArchived;
        return `<a class="nav-industry-link${isActive ? ' active' : ''}${archived ? ' archived' : ''}"
            href="/industry/${esc(ind.slug)}">
          <span class="nav-dot" style="background:${esc(industryColor(ind))}"></span>
          <span class="nav-industry-name">${esc(ind.name)}</span>
          ${archived ? '<span class="nav-archived-tag">Archived</span>' : ''}
        </a>`;
      })
      .join('');
  }

  window.OutreachUI = {
    MAIN_SITE,
    STATUSES,
    FOLLOW_STATUSES,
    TRACKS,
    INDUSTRY_COLORS,
    esc,
    badge,
    fmt,
    relativeTime,
    api,
    requireAdminShell,
    navActive,
    loadIndustries,
    industryColor,
    renderIndustrySidebar,
    openAddIndustryModal,
    openModal,
    closeModal,
  };
})();
