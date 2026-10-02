import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  parseApolloCreditUsage,
  resolveApolloApiKey,
  LEGACY_OUTREACH_WORKFLOW_IDS,
} from './apollo-credits.ts';

test('resolveApolloApiKey prefers CC_ then shared keys', () => {
  const env = new Map<string, string>([
    ['APOLLO_KEY_1', 'k1'],
    ['APOLLO_API_KEY', 'k2'],
    ['CC_APOLLO_API_KEY', 'k3'],
  ]);
  assert.equal(resolveApolloApiKey({ get: (k) => env.get(k) }), 'k3');
  env.delete('CC_APOLLO_API_KEY');
  assert.equal(resolveApolloApiKey({ get: (k) => env.get(k) }), 'k2');
  env.delete('APOLLO_API_KEY');
  assert.equal(resolveApolloApiKey({ get: (k) => env.get(k) }), 'k1');
  assert.equal(resolveApolloApiKey({ get: () => undefined }), null);
});

test('parseApolloCreditUsage reads lead_credit leftovers', () => {
  const snap = parseApolloCreditUsage({
    credit_usage_stats: {
      lead_credit: { limit: 1000, consumed: 250, left_over: 750 },
    },
    current_credit_cycle: { start_date: '2026-10-01', end_date: '2026-10-31' },
  });
  assert.equal(snap.available, true);
  assert.equal(snap.leadCreditsLeft, 750);
  assert.equal(snap.leadCreditsLimit, 1000);
  assert.equal(snap.leadCreditsConsumed, 250);
  assert.equal(snap.cycleStart, '2026-10-01');
});

test('legacy workflow ids are the pre-v2 India/US pair', () => {
  assert.deepEqual([...LEGACY_OUTREACH_WORKFLOW_IDS], [
    'yrYIauoO1q46DORb',
    '41O5a05zrxyWqpe2',
  ]);
});
