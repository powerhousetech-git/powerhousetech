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
import type { Lead } from '../types';
import { computeIndustryBreakdown } from '../lib/analytics';
import { STATUS_SERIES } from '../lib/theme';

interface IndustryBreakdownProps {
  leads: Lead[];
  limit?: number;
}

export function IndustryBreakdown({ leads, limit = 10 }: IndustryBreakdownProps) {
  const data = useMemo(
    () => computeIndustryBreakdown(leads, limit),
    [leads, limit],
  );

  if (data.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-slate-500">
        No leads to break down yet.
      </p>
    );
  }

  // Give each row ~36px of height so labels stay readable.
  const height = Math.max(240, data.length * 40 + 48);

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
          <XAxis
            type="number"
            stroke="#64748b"
            tick={{ fontSize: 11 }}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="industry"
            stroke="#64748b"
            tick={{ fontSize: 11, fill: '#cbd5e1' }}
            width={130}
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
          {STATUS_SERIES.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              stackId="a"
              fill={s.color}
              radius={
                i === STATUS_SERIES.length - 1 ? [0, 4, 4, 0] : [0, 0, 0, 0]
              }
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default IndustryBreakdown;
