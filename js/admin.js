(() => {
  const API = 'https://msratyvmnuvozuthgkmi.supabase.co/functions/v1/admin-api';
  const gateEl = document.getElementById('admin-gate');
  const shellEl = document.getElementById('admin-shell');
  const gateMsg = document.getElementById('gate-msg');

  async function api(op, opts) {
    opts = opts || {};
    const token = await window.phAuthGate.getIdToken();
    if (!token) throw new Error('Sign in required');
    const url = API + '?op=' + encodeURIComponent(op) + (opts.qs || '');
    const res = await fetch(url, {
      method: opts.method || 'GET',
      headers: {
        Authorization: 'Bearer ' + token,
        ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    if (op === 'export' && res.ok) return res;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  function showPanel(id) {
    document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
    document.querySelectorAll('[data-panel]').forEach((b) => {
      b.classList.toggle('active', b.getAttribute('data-panel') === id);
    });
    document.getElementById('panel-' + id)?.classList.add('active');
  }

  function fmt(ts) {
    if (!ts) return '—';
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return ts;
    }
  }

  async function loadOverview(users, events) {
    const weekAgo = Date.now() - 7 * 864e5;
    const active = users.filter((u) => new Date(u.last_seen_at).getTime() > weekAgo).length;
    const demos = events.filter((e) => e.event_type === 'demo_open' || e.event_type === 'dashboard_view').length;
    document.getElementById('kpi-users').textContent = String(users.length);
    document.getElementById('kpi-active').textContent = String(active);
    document.getElementById('kpi-admins').textContent = String(users.filter((u) => u.is_admin).length);
    document.getElementById('kpi-events').textContent = String(demos);
  }

  async function loadUsers() {
    const { users } = await api('users');
    const body = document.querySelector('#users-table tbody');
    body.innerHTML = users
      .map(
        (u) => `<tr>
        <td><strong>${escapeHtml(u.email)}</strong><div class="muted">${escapeHtml(u.display_name || '')}</div></td>
        <td>${escapeHtml(u.company || '—')}<div class="muted">${escapeHtml(u.phone || '')}</div></td>
        <td>${u.login_count}</td>
        <td>${fmt(u.last_seen_at)}</td>
        <td>${escapeHtml(u.last_path || '—')}</td>
        <td>${u.is_admin ? '<span class="badge badge-on">Admin</span>' : '<span class="badge badge-off">User</span>'}</td>
      </tr>`
      )
      .join('');
    return users;
  }

  async function loadEvents() {
    const { events } = await api('events');
    const body = document.querySelector('#events-table tbody');
    body.innerHTML = events
      .map(
        (e) => `<tr>
        <td>${fmt(e.created_at)}</td>
        <td>${escapeHtml(e.email)}</td>
        <td>${escapeHtml(e.event_type)}</td>
        <td>${escapeHtml(e.path || '—')}</td>
      </tr>`
      )
      .join('');
    return events;
  }

  async function loadEntitlements() {
    const { entitlements } = await api('entitlements');
    const body = document.querySelector('#ent-table tbody');
    body.innerHTML = entitlements
      .map(
        (e) => `<tr>
        <td>${escapeHtml(e.email)}</td>
        <td>${e.invoice_radar_enabled ? '<span class="badge badge-on">Enabled</span>' : '<span class="badge badge-off">Off</span>'}</td>
        <td>${e.invoice_radar_web_app_configured ? 'Configured' : 'Missing URL'}</td>
        <td><button type="button" class="toggle ${e.invoice_radar_enabled ? 'on' : ''}" data-email="${escapeAttr(e.email)}" data-on="${e.invoice_radar_enabled}" aria-label="Toggle"></button></td>
      </tr>`
      )
      .join('');
    body.querySelectorAll('.toggle').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const email = btn.getAttribute('data-email');
        const next = btn.getAttribute('data-on') !== 'true';
        btn.disabled = true;
        try {
          await api('entitlement', {
            method: 'POST',
            body: { email, invoice_radar_enabled: next },
          });
          await loadEntitlements();
        } catch (err) {
          alert(err.message);
        } finally {
          btn.disabled = false;
        }
      });
    });
  }

  async function loadCredits() {
    const { credits } = await api('credits');
    const body = document.querySelector('#credits-table tbody');
    body.innerHTML = (credits || [])
      .map(
        (c) => `<tr>
        <td>${escapeHtml(c.email)}</td>
        <td>${c.runs_remaining}</td>
        <td>${c.runs_used}</td>
        <td>${escapeHtml(c.last_tool_used || '—')}</td>
      </tr>`
      )
      .join('');
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, '&#39;');
  }

  document.querySelectorAll('[data-panel]').forEach((btn) => {
    btn.addEventListener('click', () => showPanel(btn.getAttribute('data-panel')));
  });

  document.getElementById('export-btn')?.addEventListener('click', async () => {
    try {
      const res = await api('export');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'portal-users.csv';
      a.click();
    } catch (err) {
      alert(err.message);
    }
  });

  document.getElementById('admin-signout')?.addEventListener('click', async () => {
    window.phAuthGate.clearUser();
    const fb = await window.phAuthGate.waitForFirebase();
    if (fb?.auth?.currentUser) await fb.signOut(fb.auth);
    location.href = '/portal';
  });

  async function boot() {
    const user = await window.phAuthGate.guardPage({
      returnTo: '/admin',
      eventType: 'admin_view',
      title: 'Admin',
      record: false,
    });
    if (!user) return;

    const me = await window.phAuthGate.fetchAdminMe();
    if (!me.is_admin) {
      gateMsg.textContent = 'This Google account is not an admin. Contact shreyas@powerhousetech.in.';
      gateEl.classList.remove('hidden');
      shellEl.classList.add('hidden');
      return;
    }

    await window.phAuthGate.recordSession('admin_view', '/admin', {});
    gateEl.classList.add('hidden');
    shellEl.classList.remove('hidden');
    document.getElementById('admin-email').textContent = me.email;

    const [users, events] = await Promise.all([loadUsers(), loadEvents()]);
    await loadOverview(users, events);
    await loadEntitlements();
    await loadCredits();
    showPanel('overview');
  }

  boot();
})();
