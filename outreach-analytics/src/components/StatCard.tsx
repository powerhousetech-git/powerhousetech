import type { ReactNode } from 'react';

export interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  /** Optional trend indicator, e.g. "+12%". */
  trend?: { value: string; direction: 'up' | 'down' | 'neutral' };
  accent?: 'india' | 'us' | 'positive' | 'default';
  icon?: ReactNode;
  loading?: boolean;
}

const accentBar: Record<NonNullable<StatCardProps['accent']>, string> = {
  india: 'bg-india',
  us: 'bg-us',
  positive: 'bg-positive',
  default: 'bg-slate-500',
};

const trendColor: Record<NonNullable<StatCardProps['trend']>['direction'], string> =
  {
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
  return (
    <div className="card relative overflow-hidden p-4 sm:p-5">
      <span
        className={`absolute inset-y-0 left-0 w-1 ${accentBar[accent]}`}
        aria-hidden
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-slate-400">
            {label}
          </p>
          {loading ? (
            <div className="skeleton mt-2 h-8 w-24" />
          ) : (
            <p className="mt-1 text-2xl font-semibold text-white sm:text-3xl">
              {value}
            </p>
          )}
          {hint && !loading && (
            <p className="mt-1 text-xs text-slate-500">{hint}</p>
          )}
        </div>
        {icon && <div className="shrink-0 text-slate-500">{icon}</div>}
      </div>
      {trend && !loading && (
        <p className={`mt-3 text-xs font-medium ${trendColor[trend.direction]}`}>
          {trend.direction === 'up' ? '▲' : trend.direction === 'down' ? '▼' : '—'}{' '}
          {trend.value}
        </p>
      )}
    </div>
  );
}

export default StatCard;
