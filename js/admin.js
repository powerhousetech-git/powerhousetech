(() => {
  const API = 'https://msratyvmnuvozuthgkmi.supabase.co/functions/v1/admin-api';
  const gateEl = document.getElementById('admin-gate');
  const shellEl = document.getElementById('admin-shell');
  const gateMsg = document.getElementById('gate-msg');

  // Keep in sync with supabase/functions/_shared/live-services.ts
  const FALLBACK_SERVICES = [
    { id: 'ai_sales_outreach', label: 'AI Sales Outreach', short: 'Outreach' },
    { id: 'card_capture', label: 'Card Capture', short: 'Cards' },
    { id: 'invoice_radar', label: 'Invoice Radar', short: 'Radar' },
  ];

  let liveServices = FALLBACK_SERVICES.slice();

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

  function renderAccessHeader() {
    const thead = document.querySelector('#ent-table thead tr');
    if (!thead) return;
    const serviceHeads = liveServices
      .map(
        (s) =>
          `<th data-svc-head="${escapeAttr(s.id)}" title="${escapeAttr(s.label)} live dashboard">${escapeHtml(s.short)} live</th>`
      )
      .join('');
    thead.innerHTML =
      '<th>User</th><th title="Public product demos — always on">General</th>' +
      serviceHeads +
      '<th>Radar web app</th>';
  }

  function toggleHtml(email, serviceId, on) {
    return `<button type="button" class="toggle ${on ? 'on' : ''}" data-email="${escapeAttr(email)}" data-service="${escapeAttr(serviceId)}" data-on="${on ? 'true' : 'false'}" aria-pressed="${on ? 'true' : 'false'}" aria-label="Toggle ${escapeAttr(serviceId)} for ${escapeAttr(email)}"></button>`;
  }

  async function loadEntitlements() {
    const data = await api('entitlements');
    if (Array.isArray(data.services) && data.services.length) {
      liveServices = data.services;
    }
    renderAccessHeader();

    const rows = data.entitlements || data.users || [];
    const body = document.querySelector('#ent-table tbody');
    body.innerHTML = rows
      .map((u) => {
        const access = u.access || {};
        const serviceCells = liveServices
          .map((s) => {
            const on = Boolean(access[s.id]);
            return `<td class="access-cell" data-service="${escapeAttr(s.id)}">${toggleHtml(u.email, s.id, on)}</td>`;
          })
          .join('');
        return `<tr data-email="${escapeAttr(u.email)}">
          <td>
            <strong>${escapeHtml(u.email)}</strong>
            <div class="muted">${escapeHtml(u.display_name || '')}${u.is_admin ? ' · Admin' : ''}</div>
            <div class="muted">${fmt(u.last_seen_at)}</div>
          </td>
          <td><span class="badge badge-on" title="Demos for all products">Demos</span></td>
          ${serviceCells}
          <td class="muted">${u.invoice_radar_web_app_configured ? 'Configured' : '—'}</td>
        </tr>`;
      })
      .join('');

    if (!rows.length) {
      body.innerHTML =
        '<tr><td colspan="8" class="muted" style="padding:24px;text-align:center">No signed-in users yet.</td></tr>';
    }

    body.querySelectorAll('.toggle').forEach((btn) => {
      btn.addEventListener('click', onToggleEntitlement);
    });
  }

  async function onToggleEntitlement(ev) {
    const btn = ev.currentTarget;
    if (!btn || btn.dataset.busy === '1') return;
    const email = btn.getAttribute('data-email');
    const service = btn.getAttribute('data-service');
    const next = btn.getAttribute('data-on') !== 'true';
    const prevOn = btn.getAttribute('data-on') === 'true';

    btn.dataset.busy = '1';
    btn.classList.toggle('on', next);
    btn.setAttribute('data-on', next ? 'true' : 'false');
    btn.setAttribute('aria-pressed', next ? 'true' : 'false');

    try {
      await api('entitlement', {
        method: 'POST',
        body: { email, service, enabled: next },
      });
    } catch (err) {
      btn.classList.toggle('on', prevOn);
      btn.setAttribute('data-on', prevOn ? 'true' : 'false');
      btn.setAttribute('aria-pressed', prevOn ? 'true' : 'false');
      alert(err.message || 'Could not update access');
    } finally {
      btn.dataset.busy = '0';
    }
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

    const outreach = document.getElementById('outreach-link');
    if (outreach && window.PH_SITE?.outreachPortalUrl) {
      outreach.href = window.PH_SITE.outreachPortalUrl;
    }

    const [users, events] = await Promise.all([loadUsers(), loadEvents()]);
    await loadOverview(users, events);
    await loadEntitlements();
    await loadCredits();
    showPanel('overview');
  }

  boot();
})();
