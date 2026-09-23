import type { ReactNode } from 'react';

export interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  trend?: { value: string; direction: 'up' | 'down' | 'neutral' };
  accent?: 'india' | 'us' | 'positive' | 'default';
  icon?: ReactNode;
  loading?: boolean;
}

const accentStyles: Record<
  NonNullable<StatCardProps['accent']>,
  { chip: string; glow: string }
> = {
  india: { chip: 'bg-india/15 text-india ring-india/30', glow: 'from-india/25' },
  us: { chip: 'bg-us/15 text-us ring-us/30', glow: 'from-us/25' },
  positive: { chip: 'bg-positive/15 text-positive ring-positive/30', glow: 'from-positive/25' },
  default: { chip: 'bg-slate-500/15 text-slate-300 ring-slate-500/30', glow: 'from-slate-500/20' },
};

const trendColor: Record<NonNullable<StatCardProps['trend']>['direction'], string> = {
  up: 'text-emerald-400',
  down: 'text-rose-400',
  neutral: 'text-slate-400',
};

export function StatCard({
  label,
  value,
  hint,
  trend,
  accent = 'default',
  icon,
  loading = false,
}: StatCardProps) {
  const styles = accentStyles[accent];
  return (
    <div className="card relative overflow-hidden p-5 transition-transform duration-200 hover:-translate-y-0.5">
      {/* Soft corner glow in the accent color */}
      <div
        className={`pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-gradient-to-br ${styles.glow} to-transparent opacity-70 blur-2xl`}
        aria-hidden
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-slate-400">
            {label}
          </p>
          {loading ? (
            <div className="skeleton mt-2 h-8 w-24" />
          ) : (
            <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-100">
              {value}
            </p>
          )}
          {hint && !loading && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
          {trend && !loading && (
            <p className={`mt-2 text-xs font-medium ${trendColor[trend.direction]}`}>
              {trend.direction === 'up' ? '▲' : trend.direction === 'down' ? '▼' : '—'} {trend.value}
            </p>
          )}
        </div>
        {icon && (
          <span
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg ring-1 ${styles.chip}`}
            aria-hidden
          >
            {icon}
          </span>
        )}
      </div>
    </div>
  );
}

export default StatCard;
