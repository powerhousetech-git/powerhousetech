import type { WorkflowState } from '../hooks/useN8nWorkflows';
import type { Campaign, Execution } from '../types';
import { parseDate } from '../lib/dates';

interface WorkflowCardProps {
  state: WorkflowState;
  accent: string;
  onToggleActive: () => void;
  onRun: () => void;
  onOpenExecution: (id: string) => void;
}

function formatDuration(e: Execution): string {
  const start = parseDate(e.startedAt);
  if (!start) return '—';
  const end = parseDate(e.stoppedAt) ?? (e.status === 'running' ? new Date() : null);
  if (!end) return '—';
  const ms = end.getTime() - start.getTime();
  if (ms < 0) return '—';
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 100) / 10;
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${Math.round(s % 60)}s`;
}

function formatStart(e: Execution): string {
  const d = parseDate(e.startedAt);
  if (!d) return '—';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatusBadge({ status }: { status: Execution['status'] }) {
  const map: Record<Execution['status'], string> = {
    success: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
    error: 'bg-rose-500/15 text-rose-300 ring-rose-500/30',
    running: 'bg-sky-500/15 text-sky-300 ring-sky-500/30',
    waiting: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
    canceled: 'bg-slate-500/15 text-slate-300 ring-slate-500/30',
    unknown: 'bg-slate-500/15 text-slate-300 ring-slate-500/30',
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${map[status]}`}
    >
      {status === 'running' && (
        <span className="inline-block h-2 w-2 animate-spin rounded-full border border-sky-300 border-t-transparent" />
      )}
      {status}
    </span>
  );
}

const campaignLabel: Record<Campaign, string> = { India: 'India', US: 'US' };

export function WorkflowCard({
  state,
  accent,
  onToggleActive,
  onRun,
  onOpenExecution,
}: WorkflowCardProps) {
  const active = state.status?.active ?? false;
  const name = state.status?.name ?? `${campaignLabel[state.campaign]} Outreach Sequence`;

  return (
    <div className="card p-4 sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: accent }}
              aria-hidden
            />
            <h3 className="truncate text-sm font-semibold text-slate-100">{name}</h3>
          </div>
          <p className="mt-0.5 font-mono text-xs text-slate-500">ID: {state.id || '—'}</p>
        </div>

        <button
          type="button"
          onClick={onToggleActive}
          disabled={state.busy || !state.status}
          className={[
            'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50',
            active ? 'bg-emerald-500' : 'bg-surface-700',
          ].join(' ')}
          role="switch"
          aria-checked={active}
          title={active ? 'Deactivate workflow' : 'Activate workflow'}
        >
          <span
            className={[
              'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
              active ? 'translate-x-5' : 'translate-x-1',
            ].join(' ')}
          />
        </button>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <span className="text-xs text-slate-400">
          {active ? 'Active — running on schedule' : 'Inactive'}
        </span>
        <button
          type="button"
          onClick={onRun}
          disabled={state.busy}
          className="btn-ghost ml-auto"
        >
          {state.busy ? 'Working…' : '▶ Run Now'}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-surface-700/60 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-2 py-2">Start</th>
              <th className="px-2 py-2">Duration</th>
              <th className="px-2 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {state.executions.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-2 py-6 text-center text-xs text-slate-500">
                  No recent executions.
                </td>
              </tr>
            ) : (
              state.executions.slice(0, 5).map((e) => (
                <tr
                  key={e.id}
                  onClick={() => onOpenExecution(e.id)}
                  className="cursor-pointer border-b border-surface-800 last:border-0 hover:bg-surface-800/50"
                  title="View execution details"
                >
                  <td className="whitespace-nowrap px-2 py-2 text-slate-300">{formatStart(e)}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-slate-400">{formatDuration(e)}</td>
                  <td className="px-2 py-2">
                    <StatusBadge status={e.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default WorkflowCard;
