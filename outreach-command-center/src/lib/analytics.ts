/**
 * Pure data-derivation helpers used by the dashboard components. Keeping these
 * separate from React keeps the UI thin and makes the logic easy to reason about.
 */

import type { Lead, LogEntry } from '../types';
import { dayKey, lastNDays, parseDate, todayKey } from './dates';

// --- Pipeline funnel ---------------------------------------------------------

export interface FunnelStage {
  key: string;
  label: string;
  count: number;
  /** Conversion % vs the previous stage (0 for the first stage). */
  conversionFromPrev: number;
}

/**
 * Cumulative funnel for sheet schema v2:
 * Pending → In_Sequence → Completed → Replied → Interested
 * Legacy statuses still count toward In_Sequence / Completed when present.
 */
export function computeFunnel(leads: Lead[]): FunnelStage[] {
  const inSequence = new Set([
    'In_Sequence',
    'Sent',
    'FU1_Sent',
    'FU2_Sent',
    'Completed',
    'Replied',
    'Interested',
    'Not Interested',
  ]);
  const completedish = new Set(['Completed', 'Replied', 'Interested']);
  const replied = new Set(['Replied', 'Interested']);
  const interested = new Set(['Interested']);
  const pending = new Set(['Pending', 'New']);

  const order: Array<{ key: string; label: string; match: (l: Lead) => boolean }> = [
    { key: 'Pending', label: 'Pending', match: (l) => pending.has(l.Status) },
    { key: 'In_Sequence', label: 'In Sequence', match: (l) => inSequence.has(l.Status) },
    { key: 'Completed', label: 'Completed', match: (l) => completedish.has(l.Status) },
    { key: 'Replied', label: 'Replied', match: (l) => replied.has(l.Status) },
    { key: 'Interested', label: 'Interested', match: (l) => interested.has(l.Status) },
  ];

  const counts = order.map(({ key, label, match }) => ({
    key,
    label,
    count: leads.filter(match).length,
  }));

  return counts.map((stage, i) => {
    const prev = i === 0 ? null : counts[i - 1];
    const conversionFromPrev =
      prev && prev.count > 0 ? (stage.count / prev.count) * 100 : 0;
    return { ...stage, conversionFromPrev };
  });
}

// --- Daily send volume -------------------------------------------------------

export interface DailySendPoint {
  day: string; // ISO day key
  Initial: number;
  'Follow-up 1': number;
  'Follow-up 2': number;
  total: number;
}

/** Group the email log by day + email type over the last `days` calendar days. */
export function computeDailySends(log: LogEntry[], days = 30): DailySendPoint[] {
  const window = lastNDays(days);
  const inWindow = new Set(window);

  const base = new Map<string, DailySendPoint>(
    window.map((day) => [
      day,
      { day, Initial: 0, 'Follow-up 1': 0, 'Follow-up 2': 0, total: 0 },
    ]),
  );

  for (const entry of log) {
    if (entry.Status && entry.Status.toLowerCase() === 'failed') continue;
    const d = parseDate(entry.Timestamp);
    if (!d) continue;
    const key = dayKey(d);
    if (!inWindow.has(key)) continue;

    const point = base.get(key)!;
    const type = entry.Email_Type;
    if (type === 'Initial' || type === 'Follow-up 1' || type === 'Follow-up 2') {
      point[type] += 1;
    } else if (/^Follow-up\s+\d+$/i.test(type)) {
      // Fold FU3+ into Follow-up 2 for the chart series.
      point['Follow-up 2'] += 1;
    } else {
      point.Initial += 1;
    }
    point.total += 1;
  }

  return window.map((day) => base.get(day)!);
}

/** Count of successful sends whose timestamp is today (local). */
export function emailsSentToday(log: LogEntry[]): number {
  const today = todayKey();
  return log.filter((e) => {
    if (e.Status && e.Status.toLowerCase() === 'failed') return false;
    const d = parseDate(e.Timestamp);
    return d ? dayKey(d) === today : false;
  }).length;
}

// --- Industry breakdown ------------------------------------------------------

export interface IndustryRow {
  industry: string;
  Pending: number;
  In_Sequence: number;
  Completed: number;
  Replied: number;
  total: number;
}

/** Top `limit` industries by lead count, each split into status buckets. */
export function computeIndustryBreakdown(leads: Lead[], limit = 10): IndustryRow[] {
  const byIndustry = new Map<string, IndustryRow>();

  for (const lead of leads) {
    const industry = lead.Industry || 'Unknown';
    if (!byIndustry.has(industry)) {
      byIndustry.set(industry, {
        industry,
        Pending: 0,
        In_Sequence: 0,
        Completed: 0,
        Replied: 0,
        total: 0,
      });
    }
    const row = byIndustry.get(industry)!;
    row.total += 1;

    switch (lead.Status) {
      case 'Pending':
      case 'New':
        row.Pending += 1;
        break;
      case 'In_Sequence':
      case 'Sent':
      case 'FU1_Sent':
      case 'FU2_Sent':
        row.In_Sequence += 1;
        break;
      case 'Completed':
        row.Completed += 1;
        break;
      case 'Replied':
      case 'Interested':
        row.Replied += 1;
        break;
      default:
        break;
    }
  }

  return Array.from(byIndustry.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

// --- Apollo credit efficiency ------------------------------------------------

export interface ApolloStats {
  attempted: number;
  revealed: number;
  successRate: number; // 0..100
}

/**
 * Apollo reveal efficiency:
 *  - attempted = leads with a non-empty Apollo_ID
 *  - revealed  = attempted leads that also produced a non-empty Email
 */
export function computeApolloStats(leads: Lead[]): ApolloStats {
  const attempted = leads.filter((l) => (l.Apollo_ID || l.Apollo_Person_ID).trim() !== '').length;
  const revealed = leads.filter(
    (l) => (l.Apollo_ID || l.Apollo_Person_ID).trim() !== '' && l.Email.trim() !== '',
  ).length;
  const successRate = attempted > 0 ? (revealed / attempted) * 100 : 0;
  return { attempted, revealed, successRate };
}

// --- Reply / interest tracking ----------------------------------------------

/** Leads whose status is Replied or Interested. */
export function repliedOrInterested(leads: Lead[]): Lead[] {
  return leads.filter((l) => l.Status === 'Replied' || l.Status === 'Interested');
}

/** Leads awaiting human approval before sequence start. */
export function pendingApprovals(leads: Lead[]): Lead[] {
  return leads.filter((l) => l.Status === 'Pending');
}

/** Human-readable sequence progress label. */
export function sequenceLabel(stepRaw: string, maxSteps = 10): string {
  const step = Number.parseInt(stepRaw || '0', 10);
  if (!Number.isFinite(step) || step < 0) return '—';
  if (step === 0) return 'Initial queued';
  if (step === 1) return 'Initial sent · FU1 next';
  if (step >= maxSteps) return `Done (step ${step})`;
  return `FU${step - 1} sent · FU${step} next`;
}

/** 0..1 progress fraction for Sequence_Step vs Max_Sequence_Steps. */
export function sequenceProgress(stepRaw: string, maxSteps = 10): number {
  const step = Number.parseInt(stepRaw || '0', 10);
  if (!Number.isFinite(step) || maxSteps <= 0) return 0;
  return Math.min(1, Math.max(0, step / maxSteps));
}
