import { useMemo, useState } from 'react';
import type { Lead } from '../types';
import { statusBadgeClass, campaignBadgeClass } from '../lib/theme';
import { parseDate } from '../lib/dates';
import { useToast } from './Toast';

interface LeadTableProps {
  leads: Lead[];
  showCampaign: boolean;
  onUpdate: (lead: Lead, field: 'Status' | 'Notes', value: string) => Promise<void>;
}

const STATUS_OPTIONS = [
  'New', 'Sent', 'FU1_Sent', 'FU2_Sent', 'Replied',
  'Interested', 'Not Interested', 'Unsubscribe',
];

const PAGE_SIZE = 50;
type SortKey = 'Company_Name' | 'Industry' | 'City' | 'Status' | 'Sent_Date';

function fmtDate(v: string): string {
  const d = parseDate(v);
  if (!d) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' });
}

export function LeadTable({ leads, showCampaign, onUpdate }: LeadTableProps) {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  const [industryFilter, setIndustryFilter] = useState<Set<string>>(new Set());
  const [industryOpen, setIndustryOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('Company_Name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [draftNotes, setDraftNotes] = useState('');

  const industries = useMemo(
    () => Array.from(new Set(leads.map((l) => l.Industry).filter(Boolean))).sort(),
    [leads],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = leads.filter((l) => {
      if (statusFilter.size && !statusFilter.has(l.Status)) return false;
      if (industryFilter.size && !industryFilter.has(l.Industry)) return false;
      if (q) {
        const hay = `${l.Company_Name} ${l.Contact_Name} ${l.Email} ${l.Title} ${l.City}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    rows.sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      const cmp = av.localeCompare(bv);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [leads, search, statusFilter, industryFilter, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  const toggleSet = (set: Set<string>, value: string): Set<string> => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  const sort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };
  const arrow = (key: SortKey) => (key === sortKey ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '');

  const handleStatusChange = async (lead: Lead, value: string) => {
    try {
      await onUpdate(lead, 'Status', value);
      toast.success(`${lead.Company_Name}: status → ${value}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status.');
    }
  };

  const saveNotes = async (lead: Lead) => {
    const value = draftNotes;
    setEditingNotes(null);
    if (value === lead.Notes) return;
    try {
      await onUpdate(lead, 'Notes', value);
      toast.success(`${lead.Company_Name}: notes saved`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save notes.');
    }
  };

  return (
    <div>
      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          className="input max-w-xs"
          placeholder="Search company, contact, email…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
        />
        <div className="relative">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setIndustryOpen((o) => !o)}
          >
            Industry{industryFilter.size ? ` (${industryFilter.size})` : ''} ▾
          </button>
          {industryOpen && (
            <div className="absolute z-20 mt-1 max-h-64 w-56 overflow-auto rounded-lg border border-surface-700 bg-surface-900 p-2 shadow-xl">
              {industries.length === 0 && (
                <p className="p-2 text-xs text-slate-500">No industries</p>
              )}
              {industries.map((ind) => (
                <label
                  key={ind}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm text-slate-300 hover:bg-surface-800"
                >
                  <input
                    type="checkbox"
                    checked={industryFilter.has(ind)}
                    onChange={() => {
                      setIndustryFilter((s) => toggleSet(s, ind));
                      setPage(0);
                    }}
                  />
                  {ind}
                </label>
              ))}
            </div>
          )}
        </div>
        {(statusFilter.size > 0 || industryFilter.size > 0 || search) && (
          <button
            type="button"
            className="text-xs text-slate-400 underline hover:text-slate-200"
            onClick={() => {
              setSearch('');
              setStatusFilter(new Set());
              setIndustryFilter(new Set());
              setPage(0);
            }}
          >
            Clear filters
          </button>
        )}
        <span className="ml-auto text-xs text-slate-500">{filtered.length} leads</span>
      </div>

      {/* Status chips */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {STATUS_OPTIONS.map((s) => {
          const on = statusFilter.has(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => {
                setStatusFilter((set) => toggleSet(set, s));
                setPage(0);
              }}
              className={[
                'rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 transition-colors',
                on ? statusBadgeClass(s) : 'text-slate-400 ring-surface-700 hover:bg-surface-800',
              ].join(' ')}
            >
              {s}
            </button>
          );
        })}
      </div>

      <div className="-mx-1 overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-surface-700/60 text-left text-xs uppercase tracking-wide text-slate-400">
              {showCampaign && <th className="px-3 py-2">Campaign</th>}
              <th className="cursor-pointer px-3 py-2" onClick={() => sort('Company_Name')}>
                Company{arrow('Company_Name')}
              </th>
              <th className="cursor-pointer px-3 py-2" onClick={() => sort('Industry')}>
                Industry{arrow('Industry')}
              </th>
              <th className="cursor-pointer px-3 py-2" onClick={() => sort('City')}>
                City{arrow('City')}
              </th>
              <th className="px-3 py-2">Contact</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Email</th>
              <th className="cursor-pointer px-3 py-2" onClick={() => sort('Status')}>
                Status{arrow('Status')}
              </th>
              <th className="cursor-pointer px-3 py-2" onClick={() => sort('Sent_Date')}>
                Sent{arrow('Sent_Date')}
              </th>
              <th className="px-3 py-2">Notes</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((lead) => {
              const noteKey = `${lead.campaign}-${lead._rowIndex}`;
              const editing = editingNotes === noteKey;
              return (
                <tr
                  key={noteKey}
                  className="border-b border-surface-800 last:border-0 hover:bg-surface-800/40"
                >
                  {showCampaign && (
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${campaignBadgeClass(lead.campaign)}`}
                      >
                        {lead.campaign}
                      </span>
                    </td>
                  )}
                  <td className="px-3 py-2 font-medium text-slate-100">{lead.Company_Name || '—'}</td>
                  <td className="px-3 py-2 text-slate-400">{lead.Industry || '—'}</td>
                  <td className="px-3 py-2 text-slate-400">{lead.City || '—'}</td>
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
                    <select
                      value={lead.Status}
                      onChange={(e) => handleStatusChange(lead, e.target.value)}
                      className={`rounded-full px-2 py-0.5 text-xs font-medium outline-none ring-1 ${statusBadgeClass(lead.Status)}`}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s} className="bg-surface-900 text-slate-200">
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-400">
                    {fmtDate(lead.Sent_Date)}
                  </td>
                  <td className="max-w-[240px] px-3 py-2 text-slate-400">
                    {editing ? (
                      <input
                        autoFocus
                        className="input py-1 text-xs"
                        value={draftNotes}
                        onChange={(e) => setDraftNotes(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void saveNotes(lead);
                          if (e.key === 'Escape') setEditingNotes(null);
                        }}
                        onBlur={() => void saveNotes(lead)}
                      />
                    ) : (
                      <button
                        type="button"
                        className="line-clamp-2 w-full text-left hover:text-slate-200"
                        title="Click to edit"
                        onClick={() => {
                          setEditingNotes(noteKey);
                          setDraftNotes(lead.Notes);
                        }}
                      >
                        {lead.Notes || <span className="text-slate-600">＋ add note</span>}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={showCampaign ? 10 : 9} className="px-3 py-10 text-center text-sm text-slate-500">
                  No leads match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
        <span>
          {filtered.length === 0
            ? '0'
            : `${current * PAGE_SIZE + 1}–${Math.min((current + 1) * PAGE_SIZE, filtered.length)}`}{' '}
          of {filtered.length}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-ghost px-3 py-1"
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
            className="btn-ghost px-3 py-1"
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

export default LeadTable;
