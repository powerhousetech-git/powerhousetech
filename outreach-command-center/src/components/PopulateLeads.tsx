import { useMemo, useState } from 'react';
import type { ApolloDiscoveryInput, Campaign } from '../types';
import { useToast } from './Toast';
import ConfirmModal from './ConfirmModal';

interface PopulateLeadsProps {
  busy: boolean;
  onRun: (input: ApolloDiscoveryInput) => Promise<string>;
  onDone?: () => void;
}

/** Match Apollo Discovery n8n workflow defaults (Claude 2026-10-03). */
const DEFAULT_TITLES = [
  'CEO',
  'Founder',
  'Co-Founder',
  'CTO',
  'Managing Director',
  'President',
  'Owner',
  'Director',
  'VP',
];

export function PopulateLeads({ busy, onRun, onDone }: PopulateLeadsProps) {
  const toast = useToast();
  const [campaign, setCampaign] = useState<Campaign>('India');
  const [perPage, setPerPage] = useState(25);
  const [keywords, setKeywords] = useState('');
  const [location, setLocation] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const creditEstimate = useMemo(() => Math.max(1, Math.min(100, perPage)), [perPage]);
  const locationHint = campaign === 'India' ? 'India' : 'United States';

  const start = async () => {
    setSubmitting(true);
    try {
      const input: ApolloDiscoveryInput = {
        campaign,
        per_page: creditEstimate,
        titles: DEFAULT_TITLES,
        ...(keywords.trim() ? { keywords: keywords.trim() } : {}),
        ...(location.trim() ? { location: location.trim() } : {}),
      };
      const id = await onRun(input);
      toast.success(`Discovery running in background${id ? ` (${id})` : ''}.`);
      setConfirmOpen(false);
      onDone?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start Apollo discovery.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-100">Populate Leads</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Trigger Apollo Discovery (n8n). New contacts land as Pending for approval.
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">Campaign</span>
          <div className="inline-flex rounded-lg border border-surface-700 bg-surface-950 p-0.5">
            {(['India', 'US'] as Campaign[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCampaign(c)}
                className={[
                  'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
                  campaign === c
                    ? c === 'India'
                      ? 'bg-india text-white'
                      : 'bg-us text-white'
                    : 'text-slate-400 hover:text-slate-200',
                ].join(' ')}
              >
                {c}
              </button>
            ))}
          </div>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">Max new leads (per_page)</span>
          <input
            type="number"
            min={1}
            max={100}
            className="input"
            value={perPage}
            onChange={(e) => setPerPage(Number(e.target.value) || 25)}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">Keywords (optional)</span>
          <input
            className="input"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="SaaS, EMS…"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">
            Location override (optional)
          </span>
          <input
            className="input"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder={`default: ${locationHint}`}
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn-primary"
          disabled={busy || submitting}
          onClick={() => setConfirmOpen(true)}
        >
          Populate Leads
        </button>
        <p className="text-xs text-slate-500">
          Est. ~{creditEstimate} Apollo credit{creditEstimate === 1 ? '' : 's'} (~1 per new lead).
        </p>
      </div>

      <ConfirmModal
        open={confirmOpen}
        title="Confirm Apollo Discovery"
        busy={submitting || busy}
        confirmLabel="Proceed"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void start()}
        body={
          <div className="space-y-2">
            <p>
              This will search Apollo and reveal emails for up to{' '}
              <strong className="text-slate-100">{creditEstimate}</strong> new{' '}
              <strong className="text-slate-100">{campaign}</strong> leads
              {location.trim() ? (
                <>
                  {' '}
                  in <strong className="text-slate-100">{location.trim()}</strong>
                </>
              ) : null}
              .
            </p>
            <p className="text-slate-400">
              Estimated cost: ~{creditEstimate} credit{creditEstimate === 1 ? '' : 's'} (~1 per new
              lead). Deduped across India + US tabs. New rows arrive as Status = Pending.
            </p>
          </div>
        }
      />
    </section>
  );
}

export default PopulateLeads;
