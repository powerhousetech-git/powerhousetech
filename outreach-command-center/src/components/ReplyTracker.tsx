import { useMemo, useState } from 'react';
import type { Lead } from '../types';
import { repliedOrInterested } from '../lib/analytics';
import { campaignBadgeClass, statusBadgeClass } from '../lib/theme';
import { useToast } from './Toast';

interface ReplyTrackerProps {
  leads: Lead[];
  onUpdate: (lead: Lead, field: 'Status' | 'Notes', value: string) => Promise<void>;
}

type SortKey = 'campaign' | 'Status';

export function ReplyTracker({ leads, onUpdate }: ReplyTrackerProps) {
  const toast = useToast();
  const [sortKey, setSortKey] = useState<SortKey>('Status');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const rows = useMemo(() => {
    const filtered = repliedOrInterested(leads);
    return [...filtered].sort((a, b) => {
      const cmp = (a[sortKey] ?? '').localeCompare(b[sortKey] ?? '');
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [leads, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };
  const arrow = (key: SortKey) => (key === sortKey ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '');

  const markInterested = async (lead: Lead) => {
    const key = `${lead.campaign}-${lead._rowIndex}`;
    setBusyKey(key);
    try {
      await onUpdate(lead, 'Status', 'Interested');
      toast.success(`${lead.Company_Name} marked Interested`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update.');
    } finally {
      setBusyKey(null);
    }
  };

  if (rows.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-slate-500">
        No replies or interested leads yet.
      </p>
    );
  }

  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-[820px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-surface-700/60 text-left text-xs uppercase tracking-wide text-slate-400">
            <th className="px-3 py-2">
              <button type="button" className="hover:text-slate-200" onClick={() => toggleSort('campaign')}>
                Campaign{arrow('campaign')}
              </button>
            </th>
            <th className="px-3 py-2">Company</th>
            <th className="px-3 py-2">Contact</th>
            <th className="px-3 py-2">Title</th>
            <th className="px-3 py-2">Email</th>
            <th className="px-3 py-2">
              <button type="button" className="hover:text-slate-200" onClick={() => toggleSort('Status')}>
                Status{arrow('Status')}
              </button>
            </th>
            <th className="px-3 py-2">Notes</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((lead) => {
            const key = `${lead.campaign}-${lead._rowIndex}`;
            return (
              <tr key={key} className="border-b border-surface-800 last:border-0 hover:bg-surface-800/40">
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${campaignBadgeClass(lead.campaign)}`}>
                    {lead.campaign}
                  </span>
                </td>
                <td className="px-3 py-2 font-medium text-slate-100">{lead.Company_Name || '—'}</td>
                <td className="px-3 py-2 text-slate-300">{lead.Contact_Name || '—'}</td>
                <td className="px-3 py-2 text-slate-400">{lead.Title || '—'}</td>
                <td className="px-3 py-2">
                  {lead.Email ? (
                    <a href={`mailto:${lead.Email}`} className="text-sky-400 hover:underline">
                      {lead.Email}
                    </a>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(lead.Status)}`}>
                    {lead.Status}
                  </span>
                </td>
                <td className="max-w-[260px] px-3 py-2 text-slate-400">
                  <span className="line-clamp-2" title={lead.Notes}>
                    {lead.Notes || '—'}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  {lead.Status === 'Replied' && (
                    <button
                      type="button"
                      onClick={() => markInterested(lead)}
                      disabled={busyKey === key}
                      className="rounded-md bg-positive/15 px-2.5 py-1 text-xs font-medium text-emerald-300 ring-1 ring-positive/30 hover:bg-positive/25 disabled:opacity-50"
                    >
                      {busyKey === key ? '…' : 'Mark Interested'}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default ReplyTracker;
