/**
 * Apollo credit usage (0-cost endpoint). Used by the Command Center so Populate
 * can show remaining lead credits when CC_APOLLO_API_KEY (or shared APOLLO_*) is set.
 */

export interface ApolloCreditSnapshot {
  available: boolean;
  leadCreditsLeft: number | null;
  leadCreditsLimit: number | null;
  leadCreditsConsumed: number | null;
  cycleStart: string | null;
  cycleEnd: string | null;
  message?: string;
}

export function resolveApolloApiKey(env: {
  get(key: string): string | undefined;
}): string | null {
  for (const key of ['CC_APOLLO_API_KEY', 'APOLLO_API_KEY', 'APOLLO_KEY_1']) {
    const value = env.get(key)?.trim();
    if (value) return value;
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

export function parseApolloCreditUsage(body: unknown): ApolloCreditSnapshot {
  const root = asRecord(body) || {};
  const stats = asRecord(root.credit_usage_stats) || {};
  const lead = asRecord(stats.lead_credit) || asRecord(stats.export_credit) || {};
  const cycle = asRecord(root.current_credit_cycle) || {};

  const left = num(lead.left_over);
  const limit = num(lead.limit);
  const consumed = num(lead.consumed);

  return {
    available: left !== null || limit !== null,
    leadCreditsLeft: left,
    leadCreditsLimit: limit,
    leadCreditsConsumed: consumed,
    cycleStart: typeof cycle.start_date === 'string' ? cycle.start_date : null,
    cycleEnd: typeof cycle.end_date === 'string' ? cycle.end_date : null,
  };
}

export async function fetchApolloCreditUsage(
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ApolloCreditSnapshot> {
  const res = await fetchImpl('https://api.apollo.io/api/v1/usage_stats/credit_usage_stats', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'X-Api-Key': apiKey,
    },
    body: '{}',
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  if (!res.ok) {
    return {
      available: false,
      leadCreditsLeft: null,
      leadCreditsLimit: null,
      leadCreditsConsumed: null,
      cycleStart: null,
      cycleEnd: null,
      message:
        (asRecord(parsed)?.error as string) ||
        (asRecord(parsed)?.message as string) ||
        `Apollo credit check failed (${res.status})`,
    };
  }
  return parseApolloCreditUsage(parsed);
}

/** Legacy v1 India/US outreach workflows — deactivate once portal v2 is live. */
export const LEGACY_OUTREACH_WORKFLOW_IDS = [
  'yrYIauoO1q46DORb', // India v1
  '41O5a05zrxyWqpe2', // US v1
] as const;
