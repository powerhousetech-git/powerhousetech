interface AccessGateProps {
  state: 'checking' | 'denied';
  onSignOut?: () => void;
}

/**
 * Full-page states shown before the dashboard renders:
 *  - checking: verifying the site admin session
 *  - denied:   signed in, but not an admin
 * (Signed-out users are redirected straight to the site sign-in.)
 */
export function AccessGate({ state, onSignOut }: AccessGateProps) {
  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-surface-950 px-4">
      <div
        className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full opacity-30 blur-3xl"
        style={{ background: 'radial-gradient(closest-side, #F97316, transparent)' }}
        aria-hidden
      />
      <div className="relative w-full max-w-sm text-center">
        <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-india to-orange-600 text-2xl text-white shadow-lg shadow-orange-900/30">
          ⚡
        </span>
        <h1 className="text-xl font-semibold text-slate-100">PowerhouseTech</h1>
        <p className="text-sm text-slate-400">Outreach Command Center</p>

        {state === 'checking' ? (
          <div className="mt-8 flex flex-col items-center gap-3">
            <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-india border-t-transparent" />
            <p className="text-sm text-slate-400">Verifying your admin access…</p>
          </div>
        ) : (
          <div className="card mt-8 p-6 text-left">
            <p className="text-sm font-semibold text-slate-100">Access restricted</p>
            <p className="mt-2 text-sm text-slate-400">
              You're signed in, but this dashboard is limited to PowerhouseTech
              admins. If you should have access, contact{' '}
              <span className="text-slate-300">shreyas@powerhousetech.in</span>.
            </p>
            {onSignOut && (
              <button type="button" onClick={onSignOut} className="btn-ghost mt-4 w-full">
                Sign in with a different account
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default AccessGate;
