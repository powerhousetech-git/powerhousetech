/** Date helpers that tolerate empty strings and invalid ISO values. */

/** Parse a possibly-empty/invalid ISO string. Returns null when unusable. */
export function parseDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Local calendar day key, e.g. "2026-09-23". */
export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Today's local day key. */
export function todayKey(): string {
  return dayKey(new Date());
}

/** Short label for charts/axes, e.g. "Sep 23". */
export function shortLabel(dayIso: string): string {
  const d = new Date(`${dayIso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dayIso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** An array of the last `n` local day keys, oldest first, including today. */
export function lastNDays(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    out.push(dayKey(d));
  }
  return out;
}

/** Human-friendly timestamp for the "last refreshed" indicator. */
export function formatRefreshed(d: Date | null): string {
  if (!d) return '—';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
