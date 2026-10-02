import { useEffect, useState } from 'react';
import type { Lead, OutreachSettings } from '../types';
import { campaignBadgeClass } from '../lib/theme';
import { useToast } from './Toast';
import ConfirmModal from './ConfirmModal';

interface SettingsPanelProps {
  settings: OutreachSettings;
  onSave: (next: Partial<Omit<OutreachSettings, '_rows'>>) => Promise<void>;
}

export function SettingsPanel({ settings, onSave }: SettingsPanelProps) {
  const toast = useToast();
  const [draft, setDraft] = useState({
    India_Daily_Cap: settings.India_Daily_Cap,
    US_Daily_Cap: settings.US_Daily_Cap,
    FU_Interval_Days: settings.FU_Interval_Days,
    Max_Sequence_Steps: settings.Max_Sequence_Steps,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft({
      India_Daily_Cap: settings.India_Daily_Cap,
      US_Daily_Cap: settings.US_Daily_Cap,
      FU_Interval_Days: settings.FU_Interval_Days,
      Max_Sequence_Steps: settings.Max_Sequence_Steps,
    });
  }, [
    settings.India_Daily_Cap,
    settings.US_Daily_Cap,
    settings.FU_Interval_Days,
    settings.Max_Sequence_Steps,
  ]);

  const dirty =
    draft.India_Daily_Cap !== settings.India_Daily_Cap ||
    draft.US_Daily_Cap !== settings.US_Daily_Cap ||
    draft.FU_Interval_Days !== settings.FU_Interval_Days ||
    draft.Max_Sequence_Steps !== settings.Max_Sequence_Steps;

  const save = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      toast.success('Settings saved to sheet.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card p-4 sm:p-5">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-100">Settings</h2>
        <p className="mt-0.5 text-xs text-slate-400">
          Live caps read by India/US n8n workflows — no redeploy needed after save.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field
          label="India daily cap"
          value={draft.India_Daily_Cap}
          onChange={(n) => setDraft((d) => ({ ...d, India_Daily_Cap: n }))}
        />
        <Field
          label="US daily cap"
          value={draft.US_Daily_Cap}
          onChange={(n) => setDraft((d) => ({ ...d, US_Daily_Cap: n }))}
        />
        <Field
          label="FU interval (business days)"
          value={draft.FU_Interval_Days}
          onChange={(n) => setDraft((d) => ({ ...d, FU_Interval_Days: n }))}
        />
        <Field
          label="Max sequence steps"
          value={draft.Max_Sequence_Steps}
          onChange={(n) => setDraft((d) => ({ ...d, Max_Sequence_Steps: n }))}
        />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button type="button" className="btn-primary" disabled={!dirty || saving} onClick={() => void save()}>
          {saving ? 'Saving…' : 'Save settings'}
        </button>
        {!dirty && <span className="text-xs text-slate-500">Up to date with sheet</span>}
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-400">{label}</span>
      <input
        type="number"
        min={0}
        className="input"
        value={value}
        onChange={(e) => onChange(Math.max(0, Number.parseInt(e.target.value, 10) || 0))}
      />
    </label>
  );
}

interface PendingApprovalsProps {
  leads: Lead[];
  maxSteps: number;
  onApprove: (leads: Lead[]) => Promise<void>;
  onReject: (leads: Lead[]) => Promise<void>;
}

export function PendingApprovals({ leads, onApprove, onReject }: PendingApprovalsProps) {
  const toast = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<'approve' | 'reject' | null>(null);

  const keyOf = (l: Lead) => `${l.campaign}:${l._rowIndex}`;

  const toggle = (l: Lead) => {
    const k = keyOf(l);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const allSelected = leads.length > 0 && leads.every((l) => selected.has(keyOf(l)));
  const selectedLeads = leads.filter((l) => selected.has(keyOf(l)));

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(leads.map(keyOf)));
  };

  const run = async (action: 'approve' | 'reject') => {
    const targets = selectedLeads.length ? selectedLeads : [];
    if (!targets.length) return;
    setBusy(true);
    try {
      if (action === 'approve') {
        await onApprove(targets);
        toast.success(`Approved ${targets.length} lead${targets.length === 1 ? '' : 's'} → In_Sequence`);
      } else {
        await onReject(targets);
        toast.success(`Rejected ${targets.length} lead${targets.length === 1 ? '' : 's'}`);
      }
      setSelected(new Set());
      setConfirm(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed.');
    } finally {
      setBusy(false);
    }
  };

  const approveOne = async (lead: Lead) => {
    setBusy(true);
    try {
      await onApprove([lead]);
      toast.success(`Approved ${lead.Contact_Name || lead.Company_Name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Approve failed.');
    } finally {
      setBusy(false);
    }
  };

  const rejectOne = async (lead: Lead) => {
    setBusy(true);
    try {
      await onReject([lead]);
      toast.success(`Rejected ${lead.Contact_Name || lead.Company_Name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Reject failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-700/60 px-4 py-3 sm:px-5">
        <div>
          <h2 className="text-base font-semibold text-slate-100">Pending Approvals</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Status = Pending · approve to start sequence (In_Sequence, step 0)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-primary"
            disabled={busy || !selectedLeads.length}
            onClick={() => setConfirm('approve')}
          >
            Approve selected ({selectedLeads.length})
          </button>
          <button
            type="button"
            className="btn-ghost"
            disabled={busy || !selectedLeads.length}
            onClick={() => setConfirm('reject')}
          >
            Reject selected
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-surface-700/60 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-3 py-2">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" />
              </th>
              <th className="px-3 py-2">Campaign</th>
              <th className="px-3 py-2">Company</th>
              <th className="px-3 py-2">Contact</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">LinkedIn</th>
              <th className="px-3 py-2">Industry</th>
              <th className="px-3 py-2">City</th>
              <th className="px-3 py-2">Added</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-10 text-center text-sm text-slate-500">
                  No pending leads. Run Populate Leads to discover contacts.
                </td>
              </tr>
            ) : (
              leads.map((l) => (
                <tr key={keyOf(l)} className="border-b border-surface-800 last:border-0 hover:bg-surface-800/40">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(keyOf(l))}
                      onChange={() => toggle(l)}
                      aria-label={`Select ${l.Contact_Name}`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${campaignBadgeClass(l.campaign)}`}>
                      {l.campaign}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-200">{l.Company_Name || '—'}</td>
                  <td className="px-3 py-2 text-slate-200">{l.Contact_Name || '—'}</td>
                  <td className="px-3 py-2 text-slate-400">{l.Title || '—'}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-300">{l.Email || '—'}</td>
                  <td className="px-3 py-2">
                    {l.LinkedIn_URL ? (
                      <a
                        href={l.LinkedIn_URL}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sky-400 hover:underline"
                      >
                        Profile
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-400">{l.Industry || '—'}</td>
                  <td className="px-3 py-2 text-slate-400">{l.City || '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-400">{l.Added_Date || '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <button
                      type="button"
                      className="mr-2 text-xs font-medium text-emerald-300 hover:underline disabled:opacity-50"
                      disabled={busy}
                      onClick={() => void approveOne(l)}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="text-xs font-medium text-rose-300 hover:underline disabled:opacity-50"
                      disabled={busy}
                      onClick={() => void rejectOne(l)}
                    >
                      Reject
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        open={confirm === 'approve'}
        title="Approve selected leads"
        busy={busy}
        confirmLabel="Approve"
        onCancel={() => setConfirm(null)}
        onConfirm={() => void run('approve')}
        body={
          <p>
            Set Status = In_Sequence, Sequence_Step = 0, Next_Send_Date = empty for{' '}
            <strong className="text-slate-100">{selectedLeads.length}</strong> lead
            {selectedLeads.length === 1 ? '' : 's'}. They become eligible for the next n8n send run.
          </p>
        }
      />
      <ConfirmModal
        open={confirm === 'reject'}
        title="Reject selected leads"
        busy={busy}
        danger
        confirmLabel="Reject"
        onCancel={() => setConfirm(null)}
        onConfirm={() => void run('reject')}
        body={
          <p>
            Mark <strong className="text-slate-100">{selectedLeads.length}</strong> lead
            {selectedLeads.length === 1 ? '' : 's'} as Rejected (kept for audit, never emailed).
          </p>
        }
      />
    </section>
  );
}

export default PendingApprovals;
