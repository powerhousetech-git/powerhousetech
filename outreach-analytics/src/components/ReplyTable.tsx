import { useMemo, useState } from 'react';
import type { Lead } from '../types';
import { repliedOrInterested } from '../lib/analytics';
import { campaignBadgeClass, statusBadgeClass } from '../lib/theme';

interface ReplyTableProps {
  leads: Lead[];
}

type SortKey = 'campaign' | 'Status';
type SortDir = 'asc' | 'desc';

export function ReplyTable({ leads }: ReplyTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('Status');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const rows = useMemo(() => {
    const filtered = repliedOrInterested(leads);
    const sorted = [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      const cmp = av.localeCompare(bv);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [leads, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortIndicator = (key: SortKey) =>
    key === sortKey ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';

  if (rows.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-slate-500">
        No replies or interested leads yet.
      </p>
    );
  }

  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-surface-700/60 text-left text-xs uppercase tracking-wide text-slate-400">
            <th className="px-3 py-2">
              <button
                type="button"
                className="hover:text-slate-200"
                onClick={() => toggleSort('campaign')}
              >
                Campaign{sortIndicator('campaign')}
              </button>
            </th>
            <th className="px-3 py-2">Company</th>
            <th className="px-3 py-2">Contact</th>
            <th className="px-3 py-2">Title</th>
            <th className="px-3 py-2">Email</th>
            <th className="px-3 py-2">
              <button
                type="button"
                className="hover:text-slate-200"
                onClick={() => toggleSort('Status')}
              >
                Status{sortIndicator('Status')}
              </button>
            </th>
            <th className="px-3 py-2">Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((lead, i) => (
            <tr
              key={`${lead.campaign}-${lead.Email}-${i}`}
              className="border-b border-surface-800 last:border-0 hover:bg-surface-800/40"
            >
              <td className="px-3 py-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${campaignBadgeClass(
                    lead.campaign,
                  )}`}
                >
                  {lead.campaign}
                </span>
              </td>
              <td className="px-3 py-2 font-medium text-slate-100">
                {lead.Company_Name || '—'}
              </td>
              <td className="px-3 py-2 text-slate-300">
                {lead.Contact_Name || '—'}
              </td>
              <td className="px-3 py-2 text-slate-400">{lead.Title || '—'}</td>
              <td className="px-3 py-2">
                {lead.Email ? (
                  <a
                    href={`mailto:${lead.Email}`}
                    className="text-sky-400 hover:underline"
                  >
                    {lead.Email}
                  </a>
                ) : (
                  '—'
                )}
              </td>
              <td className="px-3 py-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(
                    lead.Status,
                  )}`}
                >
                  {lead.Status}
                </span>
              </td>
              <td className="max-w-[280px] px-3 py-2 text-slate-400">
                <span className="line-clamp-2" title={lead.Notes}>
                  {lead.Notes || '—'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ReplyTable;
