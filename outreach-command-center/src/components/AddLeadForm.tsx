import { useState } from 'react';
import type { Campaign, NewLeadInput } from '../types';
import { useToast } from './Toast';

interface AddLeadFormProps {
  onAdd: (input: NewLeadInput) => Promise<void>;
}

const STATUS_OPTIONS = [
  'New', 'Sent', 'FU1_Sent', 'FU2_Sent', 'Replied',
  'Interested', 'Not Interested', 'Unsubscribe',
];

const EMPTY: NewLeadInput = {
  campaign: 'India',
  Company_Name: '',
  Industry: '',
  City: '',
  Contact_Name: '',
  Email: '',
  Title: '',
  Status: 'New',
  Notes: '',
};

export function AddLeadForm({ onAdd }: AddLeadFormProps) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<NewLeadInput>(EMPTY);
  const [submitting, setSubmitting] = useState(false);

  const set = <K extends keyof NewLeadInput>(key: K, value: NewLeadInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const canSubmit =
    form.Company_Name.trim() !== '' &&
    form.Industry.trim() !== '' &&
    form.Contact_Name.trim() !== '';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      await onAdd(form);
      toast.success(`Added lead: ${form.Company_Name}`);
      setForm({ ...EMPTY, campaign: form.campaign });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add lead.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="card p-4 sm:p-5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between"
      >
        <div className="text-left">
          <h2 className="text-base font-semibold text-slate-100">Add Lead</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Append a new lead directly to the sheet (no workflow trigger)
          </p>
        </div>
        <span className="text-slate-400">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <form onSubmit={submit} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-400">Campaign</label>
            <div className="inline-flex rounded-lg border border-surface-700 bg-surface-950 p-0.5">
              {(['India', 'US'] as Campaign[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => set('campaign', c)}
                  className={[
                    'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
                    form.campaign === c
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
          </div>

          <Field label="Company Name" required>
            <input
              className="input"
              value={form.Company_Name}
              onChange={(e) => set('Company_Name', e.target.value)}
              placeholder="Acme Corp"
            />
          </Field>
          <Field label="Industry" required>
            <input
              className="input"
              value={form.Industry}
              onChange={(e) => set('Industry', e.target.value)}
              placeholder="EMS, Textiles…"
            />
          </Field>
          <Field label="City">
            <input className="input" value={form.City} onChange={(e) => set('City', e.target.value)} />
          </Field>
          <Field label="Contact Name" required>
            <input
              className="input"
              value={form.Contact_Name}
              onChange={(e) => set('Contact_Name', e.target.value)}
              placeholder="Jane Doe"
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              className="input"
              value={form.Email}
              onChange={(e) => set('Email', e.target.value)}
              placeholder="jane@acme.com"
            />
          </Field>
          <Field label="Title">
            <input
              className="input"
              value={form.Title}
              onChange={(e) => set('Title', e.target.value)}
              placeholder="Managing Director"
            />
          </Field>
          <Field label="Status">
            <select
              className="input"
              value={form.Status}
              onChange={(e) => set('Status', e.target.value)}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Notes">
              <textarea
                className="input min-h-[72px]"
                value={form.Notes}
                onChange={(e) => set('Notes', e.target.value)}
              />
            </Field>
          </div>

          <div className="flex items-center gap-3 sm:col-span-2">
            <button type="submit" className="btn-primary" disabled={!canSubmit || submitting}>
              {submitting ? 'Adding…' : 'Add Lead'}
            </button>
            <span className="text-xs text-slate-500">* required</span>
          </div>
        </form>
      )}
    </section>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-400">
        {label}
        {required && <span className="text-india"> *</span>}
      </span>
      {children}
    </label>
  );
}

export default AddLeadForm;
