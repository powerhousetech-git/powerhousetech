import { useMemo } from 'react';
import type { Lead } from '../types';
import { computeFunnel } from '../lib/analytics';

interface PipelineFunnelProps {
  leads: Lead[];
  /** Accent color for the bars. */
  accent?: string;
}

export function PipelineFunnel({
  leads,
  accent = '#F97316',
}: PipelineFunnelProps) {
  const stages = useMemo(() => computeFunnel(leads), [leads]);
  const max = Math.max(1, ...stages.map((s) => s.count));

  return (
    <div className="space-y-3">
      {stages.map((stage, i) => {
        const widthPct = Math.max((stage.count / max) * 100, stage.count > 0 ? 4 : 0);
        return (
          <div key={stage.key} className="group">
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium text-slate-200">{stage.label}</span>
              <span className="flex items-center gap-3 text-slate-400">
                {i > 0 && (
                  <span
                    className="tabular-nums text-xs"
                    title="Conversion from previous stage"
                  >
                    {stage.conversionFromPrev.toFixed(0)}%
                  </span>
                )}
                <span className="tabular-nums font-semibold text-white">
                  {stage.count.toLocaleString()}
                </span>
              </span>
            </div>
            <div className="h-7 w-full overflow-hidden rounded-md bg-surface-800">
              <div
                className="flex h-full items-center rounded-md shadow-sm transition-all duration-500"
                style={{
                  width: `${widthPct}%`,
                  backgroundImage: `linear-gradient(90deg, ${accent}, ${accent}bb)`,
                  opacity: 1 - i * 0.1,
                }}
              />
            </div>
          </div>
        );
      })}
      {leads.length === 0 && (
        <p className="py-6 text-center text-sm text-slate-500">No leads yet.</p>
      )}
    </div>
  );
}

export default PipelineFunnel;
