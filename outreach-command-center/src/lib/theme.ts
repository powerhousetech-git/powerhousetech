/** Shared color tokens used across charts and status badges. */

export const COLORS = {
  india: '#F97316',
  us: '#3B82F6',
  positive: '#22C55E',
  initial: '#3B82F6',
  followup1: '#F97316',
  followup2: '#22C55E',
  slate: '#64748b',
  slateLight: '#94a3b8',
} as const;

/** Status buckets used by the stacked industry chart. */
export const STATUS_SERIES: Array<{ key: string; label: string; color: string }> = [
  { key: 'New', label: 'New', color: '#64748b' },
  { key: 'Sent', label: 'Sent', color: '#3B82F6' },
  { key: 'FU1_Sent', label: 'Follow-up 1', color: '#F97316' },
  { key: 'FU2_Sent', label: 'Follow-up 2', color: '#a855f7' },
  { key: 'Replied', label: 'Replied / Interested', color: '#22C55E' },
];

/** Tailwind badge classes for each lead status. */
export function statusBadgeClass(status: string): string {
  switch (status) {
    case 'Interested':
    case 'Replied':
      return 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30';
    case 'New':
      return 'bg-slate-500/15 text-slate-300 ring-1 ring-slate-500/30';
    case 'Sent':
      return 'bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30';
    case 'FU1_Sent':
      return 'bg-orange-500/15 text-orange-300 ring-1 ring-orange-500/30';
    case 'FU2_Sent':
      return 'bg-fuchsia-500/15 text-fuchsia-300 ring-1 ring-fuchsia-500/30';
    case 'Not Interested':
    case 'Unsubscribe':
      return 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30';
    default:
      return 'bg-slate-500/15 text-slate-300 ring-1 ring-slate-500/30';
  }
}

/** Badge classes for a campaign chip. */
export function campaignBadgeClass(campaign: string): string {
  return campaign === 'India'
    ? 'bg-orange-500/15 text-orange-300 ring-1 ring-orange-500/30'
    : 'bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/30';
}
