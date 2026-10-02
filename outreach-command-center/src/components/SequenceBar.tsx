import { sequenceLabel, sequenceProgress } from '../lib/analytics';

interface SequenceBarProps {
  step: string;
  maxSteps?: number;
  nextSendDate?: string;
  compact?: boolean;
}

export function SequenceBar({
  step,
  maxSteps = 10,
  nextSendDate,
  compact = false,
}: SequenceBarProps) {
  const pct = Math.round(sequenceProgress(step, maxSteps) * 100);
  const label = sequenceLabel(step, maxSteps);
  const due =
    nextSendDate === undefined
      ? null
      : nextSendDate.trim() === ''
        ? 'due now'
        : `next ${nextSendDate}`;

  return (
    <div className={compact ? 'min-w-[140px]' : 'w-full'}>
      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
        <span className="truncate text-slate-300">{label}</span>
        <span className="shrink-0 text-slate-500">
          {step || '0'}/{maxSteps}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-400 transition-all"
          style={{ width: `${pct}%` }}
          aria-hidden
        />
      </div>
      {due && <p className="mt-1 text-[11px] text-slate-500">{due}</p>}
    </div>
  );
}

export default SequenceBar;
