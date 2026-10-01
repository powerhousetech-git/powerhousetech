import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { LogEntry } from '../types';
import { computeDailySends } from '../lib/analytics';
import { shortLabel } from '../lib/dates';
import { COLORS } from '../lib/theme';

interface DailySendChartProps {
  log: LogEntry[];
  days?: number;
}

export function DailySendChart({ log, days = 30 }: DailySendChartProps) {
  const data = useMemo(
    () =>
      computeDailySends(log, days).map((d) => ({
        ...d,
        label: shortLabel(d.day),
      })),
    [log, days],
  );

  const hasData = data.some((d) => d.total > 0);

  return (
    <div className="h-72 w-full">
      {!hasData && (
        <p className="pb-2 text-xs text-slate-500">
          No sends recorded in this window yet.
        </p>
      )}
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis
            dataKey="label"
            stroke="#64748b"
            tick={{ fontSize: 11 }}
            interval="preserveStartEnd"
            minTickGap={16}
          />
          <YAxis
            stroke="#64748b"
            tick={{ fontSize: 11 }}
            allowDecimals={false}
            width={40}
          />
          <Tooltip
            cursor={{ fill: 'rgba(148,163,184,0.08)' }}
            contentStyle={{
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: '#e2e8f0' }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Initial" stackId="a" fill={COLORS.initial} radius={[0, 0, 0, 0]} />
          <Bar dataKey="Follow-up 1" stackId="a" fill={COLORS.followup1} />
          <Bar
            dataKey="Follow-up 2"
            stackId="a"
            fill={COLORS.followup2}
            radius={[3, 3, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default DailySendChart;
