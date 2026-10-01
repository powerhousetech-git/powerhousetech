import { useEffect } from 'react';
import type { Execution } from '../types';

interface ExecutionModalProps {
  open: boolean;
  loading: boolean;
  execution: Execution | null;
  error?: string | null;
  onClose: () => void;
}

export function ExecutionModal({
  open,
  loading,
  execution,
  error,
  onClose,
}: ExecutionModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />
      <div className="card relative z-10 flex max-h-[85vh] w-full max-w-3xl flex-col">
        <header className="flex items-center justify-between border-b border-surface-700/60 px-5 py-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              Execution {execution ? `#${execution.id}` : ''}
            </h3>
            {execution && (
              <p className="text-xs text-slate-500">
                Status: {execution.status}
                {execution.mode ? ` · mode: ${execution.mode}` : ''}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg border border-surface-700 text-slate-300 hover:bg-surface-800"
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div className="min-h-[120px] flex-1 overflow-auto p-5">
          {loading ? (
            <div className="space-y-2">
              <div className="skeleton h-4 w-1/2" />
              <div className="skeleton h-4 w-3/4" />
              <div className="skeleton h-4 w-2/3" />
            </div>
          ) : error ? (
            <p className="text-sm text-rose-300">{error}</p>
          ) : (
            <pre className="whitespace-pre-wrap break-words rounded-lg bg-surface-950 p-4 text-xs leading-relaxed text-slate-300">
              {JSON.stringify(execution?.data ?? execution ?? {}, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

export default ExecutionModal;
