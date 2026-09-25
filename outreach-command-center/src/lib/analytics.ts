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
 * Cumulative funnel: each stage counts every lead that has reached at least
 * that stage. A lead that has "Replied" also counts toward Sent, FU1_Sent, etc.
 */
export function computeFunnel(leads: Lead[]): FunnelStage[] {
  // Downstream statuses that imply a lead has passed through each stage.
  const reached = {
    New: new Set(['New']),
    Sent: new Set([
      'Sent',
      'FU1_Sent',
      'FU2_Sent',
      'Replied',
      'Interested',
      'Not Interested',
    ]),
    FU1_Sent: new Set(['FU1_Sent', 'FU2_Sent', 'Replied', 'Interested']),
    FU2_Sent: new Set(['FU2_Sent', 'Replied', 'Interested']),
    Replied: new Set(['Replied', 'Interested']),
    Interested: new Set(['Interested']),
  };

  const order: Array<{ key: keyof typeof reached; label: string }> = [
    { key: 'New', label: 'New' },
    { key: 'Sent', label: 'Sent' },
    { key: 'FU1_Sent', label: 'Follow-up 1' },
    { key: 'FU2_Sent', label: 'Follow-up 2' },
    { key: 'Replied', label: 'Replied' },
    { key: 'Interested', label: 'Interested' },
  ];

  const counts = order.map(({ key, label }) => ({
    key,
    label,
    count: leads.filter((l) => reached[key].has(l.Status)).length,
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
    // Only count successful sends toward volume.
    if (entry.Status && entry.Status.toLowerCase() === 'failed') continue;
    const d = parseDate(entry.Timestamp);
    if (!d) continue;
    const key = dayKey(d);
    if (!inWindow.has(key)) continue;

    const point = base.get(key)!;
    const type = entry.Email_Type;
    if (type === 'Initial' || type === 'Follow-up 1' || type === 'Follow-up 2') {
      point[type] += 1;
    } else {
      // Unknown/blank types still count toward the daily total via Initial-ish.
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
  New: number;
  Sent: number;
  FU1_Sent: number;
  FU2_Sent: number;
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
        New: 0,
        Sent: 0,
        FU1_Sent: 0,
        FU2_Sent: 0,
        Replied: 0,
        total: 0,
      });
    }
    const row = byIndustry.get(industry)!;
    row.total += 1;

    switch (lead.Status) {
      case 'New':
        row.New += 1;
        break;
      case 'Sent':
        row.Sent += 1;
        break;
      case 'FU1_Sent':
        row.FU1_Sent += 1;
        break;
      case 'FU2_Sent':
        row.FU2_Sent += 1;
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
 *  - attempted = leads with a non-empty Apollo_Person_ID
 *  - revealed  = attempted leads that also produced a non-empty Email
 */
export function computeApolloStats(leads: Lead[]): ApolloStats {
  const attempted = leads.filter((l) => l.Apollo_Person_ID.trim() !== '').length;
  const revealed = leads.filter(
    (l) => l.Apollo_Person_ID.trim() !== '' && l.Email.trim() !== '',
  ).length;
  const successRate = attempted > 0 ? (revealed / attempted) * 100 : 0;
  return { attempted, revealed, successRate };
}

// --- Reply / interest tracking ----------------------------------------------

/** Leads whose status is Replied or Interested. */
export function repliedOrInterested(leads: Lead[]): Lead[] {
  return leads.filter(
    (l) => l.Status === 'Replied' || l.Status === 'Interested',
  );
}
