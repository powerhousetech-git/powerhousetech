import { useMemo, useState } from 'react';
import type { LogEntry } from '../types';
import { parseDate } from '../lib/dates';
import { campaignBadgeClass } from '../lib/theme';

interface EmailLogTableProps {
  log: LogEntry[];
  /** Cap on how many recent rows to show. */
  max?: number;
  pageSize?: number;
}

function formatTs(ts: string): string {
  const d = parseDate(ts);
  if (!d) return ts || '—';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function EmailLogTable({ log, max = 50, pageSize = 10 }: EmailLogTableProps) {
  const [page, setPage] = useState(0);

  const rows = useMemo(() => {
    // Newest first; fall back to original order when timestamps are unparseable.
    return [...log]
      .sort((a, b) => {
        const da = parseDate(a.Timestamp)?.getTime() ?? 0;
        const db = parseDate(b.Timestamp)?.getTime() ?? 0;
        return db - da;
      })
      .slice(0, max);
  }, [log, max]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pageCount - 1);
  const pageRows = rows.slice(current * pageSize, current * pageSize + pageSize);

  if (rows.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-slate-500">
        No email activity logged yet.
      </p>
    );
  }

  return (
    <div>
      <div className="-mx-1 overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-surface-700/60 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-3 py-2">Timestamp</th>
              <th className="px-3 py-2">Campaign</th>
              <th className="px-3 py-2">Company</th>
              <th className="px-3 py-2">Contact</th>
              <th className="px-3 py-2">Email Type</th>
              <th className="px-3 py-2">Subject</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((entry, i) => {
              const failed = entry.Status?.toLowerCase() === 'failed';
              return (
                <tr
                  key={`${entry.Timestamp}-${entry.Email}-${i}`}
                  className="border-b border-surface-800 last:border-0 hover:bg-surface-800/40"
                >
                  <td className="whitespace-nowrap px-3 py-2 text-slate-400">
                    {formatTs(entry.Timestamp)}
                  </td>
                  <td className="px-3 py-2">
                    {entry.Campaign ? (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${campaignBadgeClass(
                          entry.Campaign,
                        )}`}
                      >
                        {entry.Campaign}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-2 font-medium text-slate-100">
                    {entry.Company_Name || '—'}
                  </td>
                  <td className="px-3 py-2 text-slate-300">
                    {entry.Contact_Name || '—'}
                  </td>
                  <td className="px-3 py-2 text-slate-400">
                    {entry.Email_Type || '—'}
                  </td>
                  <td className="max-w-[260px] px-3 py-2 text-slate-300">
                    <span className="line-clamp-1" title={entry.Subject}>
                      {entry.Subject || '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        failed
                          ? 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30'
                          : 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30'
                      }`}
                    >
                      {entry.Status || 'Sent'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
        <span>
          Showing {current * pageSize + 1}–
          {Math.min((current + 1) * pageSize, rows.length)} of {rows.length}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-md border border-surface-700 px-3 py-1 hover:bg-surface-800 disabled:opacity-40"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={current === 0}
          >
            Prev
          </button>
          <span className="tabular-nums">
            {current + 1} / {pageCount}
          </span>
          <button
            type="button"
            className="rounded-md border border-surface-700 px-3 py-1 hover:bg-surface-800 disabled:opacity-40"
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={current >= pageCount - 1}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

export default EmailLogTable;
