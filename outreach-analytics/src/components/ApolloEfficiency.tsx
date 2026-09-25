import { useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import type { Lead } from '../types';
import { computeApolloStats } from '../lib/analytics';
import { COLORS } from '../lib/theme';

interface ApolloEfficiencyProps {
  leads: Lead[];
}

export function ApolloEfficiency({ leads }: ApolloEfficiencyProps) {
  const stats = useMemo(() => computeApolloStats(leads), [leads]);

  const notRevealed = Math.max(0, stats.attempted - stats.revealed);
  const donutData = [
    { name: 'Revealed', value: stats.revealed, color: COLORS.positive },
    { name: 'Not revealed', value: notRevealed, color: '#334155' },
  ];
  const hasAttempts = stats.attempted > 0;

  return (
    <div className="grid grid-cols-1 items-center gap-6 sm:grid-cols-[1fr_auto]">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MiniStat label="Reveals attempted" value={stats.attempted} />
        <MiniStat
          label="Emails revealed"
          value={stats.revealed}
          accent="text-emerald-400"
        />
        <MiniStat
          label="Success rate"
          value={`${stats.successRate.toFixed(1)}%`}
          accent="text-emerald-400"
        />
      </div>

      <div className="relative mx-auto h-40 w-40">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={hasAttempts ? donutData : [{ name: 'none', value: 1, color: '#334155' }]}
              dataKey="value"
              innerRadius={52}
              outerRadius={72}
              startAngle={90}
              endAngle={-270}
              stroke="none"
              paddingAngle={hasAttempts ? 2 : 0}
            >
              {(hasAttempts ? donutData : [{ color: '#334155' }]).map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold text-white">
            {stats.successRate.toFixed(0)}%
          </span>
          <span className="text-[10px] uppercase tracking-wide text-slate-500">
            revealed
          </span>
        </div>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  accent = 'text-white',
}: {
  label: string;
  value: number | string;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border border-surface-700/60 bg-surface-800/40 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${accent}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
    </div>
  );
}

export default ApolloEfficiency;
