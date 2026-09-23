import type { Theme } from '../hooks/useTheme';
import type { WorkflowStatus } from '../types';
import { formatRefreshed } from '../lib/dates';

interface HeaderProps {
  lastFetched: Date | null;
  onRefresh: () => void;
  loading: boolean;
  theme: Theme;
  onToggleTheme: () => void;
  india: WorkflowStatus | null;
  us: WorkflowStatus | null;
  isMock: boolean;
  onOpenMobile: () => void;
  onSignOut: () => void;
}

function StatusPill({ label, active }: { label: string; active: boolean | null }) {
  const on = active === true;
  const known = active !== null;
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1',
        !known
          ? 'bg-surface-800 text-slate-400 ring-surface-700'
          : on
            ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30'
            : 'bg-rose-500/15 text-rose-300 ring-rose-500/30',
      ].join(' ')}
      title={known ? (on ? 'Active' : 'Inactive') : 'Unknown'}
    >
      <span aria-hidden>{!known ? '⚪' : on ? '🟢' : '🔴'}</span>
      {label}
    </span>
  );
}

export function Header({
  lastFetched,
  onRefresh,
  loading,
  theme,
  onToggleTheme,
  india,
  us,
  isMock,
  onOpenMobile,
  onSignOut,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-surface-700/60 bg-surface-950/85 backdrop-blur">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <button
          type="button"
          className="grid h-9 w-9 place-items-center rounded-lg border border-surface-700 text-slate-300 md:hidden"
          onClick={onOpenMobile}
          aria-label="Open menu"
        >
          ☰
        </button>

        <div className="mr-auto">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-slate-100">
              Outreach Command Center
            </h1>
            {isMock && (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300 ring-1 ring-amber-500/30">
                Sample data
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Last refreshed: {formatRefreshed(lastFetched)}
          </p>
        </div>

        <div className="hidden items-center gap-2 sm:flex">
          <StatusPill label="India Workflow" active={india ? india.active : null} />
          <StatusPill label="US Workflow" active={us ? us.active : null} />
        </div>

        <button
          type="button"
          onClick={onToggleTheme}
          className="grid h-9 w-9 place-items-center rounded-lg border border-surface-700 text-slate-300 hover:bg-surface-800"
          aria-label="Toggle theme"
          title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
        >
          {theme === 'dark' ? '☀' : '☾'}
        </button>

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="btn-primary"
        >
          <span className={loading ? 'inline-block animate-spin' : ''}>↻</span>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>

        {!isMock && (
          <button
            type="button"
            onClick={onSignOut}
            className="btn-ghost"
            title="Sign out"
          >
            Sign out
          </button>
        )}
      </div>
    </header>
  );
}

export default Header;
