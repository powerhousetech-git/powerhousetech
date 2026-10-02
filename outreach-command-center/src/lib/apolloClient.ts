import { apiFetch } from './apiClient';
import { COMMAND_CENTER_API, IS_MOCK } from './config';

export interface ApolloCreditSnapshot {
  available: boolean;
  leadCreditsLeft: number | null;
  leadCreditsLimit: number | null;
  leadCreditsConsumed: number | null;
  cycleStart: string | null;
  cycleEnd: string | null;
  message?: string;
}

export async function fetchApolloCredits(): Promise<ApolloCreditSnapshot> {
  if (IS_MOCK) {
    return {
      available: true,
      leadCreditsLeft: 420,
      leadCreditsLimit: 1000,
      leadCreditsConsumed: 580,
      cycleStart: null,
      cycleEnd: null,
    };
  }
  return apiFetch<ApolloCreditSnapshot>(
    `${COMMAND_CENTER_API}?target=apollo&path=${encodeURIComponent('credits')}`,
  );
}

/** Best-effort deactivate of pre-v2 India/US outreach workflows. */
export async function retireLegacyWorkflows(): Promise<{
  retired: Array<{ id: string; ok: boolean; active?: boolean; error?: string }>;
}> {
  if (IS_MOCK) {
    return {
      retired: [
        { id: 'yrYIauoO1q46DORb', ok: true, active: false },
        { id: '41O5a05zrxyWqpe2', ok: true, active: false },
      ],
    };
  }
  return apiFetch(`${COMMAND_CENTER_API}?target=n8n&path=${encodeURIComponent('retire-legacy')}`, {
    method: 'POST',
    body: {},
  });
}
