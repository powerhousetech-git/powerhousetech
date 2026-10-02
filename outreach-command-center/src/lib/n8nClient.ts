/**
 * n8n access — through the server-side proxy. The API key stays in the
 * serverless function's env. The client sends the sub-path (after `/api/v1/`),
 * including any query string, URL-encoded in `path`.
 *
 * Only reads status/executions and triggers runs / (de)activation — never edits
 * workflow logic.
 */

import type { ApolloDiscoveryInput, Execution, ExecutionStatus, WorkflowStatus } from '../types';
import { apiFetch } from './apiClient';
import { COMMAND_CENTER_API, loadConfig } from './config';

function n8nUrl(subPath: string): string {
  return `${COMMAND_CENTER_API}?target=n8n&path=${encodeURIComponent(subPath)}`;
}

function normalizeStatus(raw: unknown): ExecutionStatus {
  const s = String(raw ?? '').toLowerCase();
  if (s === 'running' || s === 'success' || s === 'error' || s === 'waiting' || s === 'canceled') {
    return s;
  }
  if (s === 'finished') return 'success';
  if (s === 'crashed' || s === 'failed') return 'error';
  return 'unknown';
}

export async function getWorkflow(workflowId: string): Promise<WorkflowStatus> {
  const data = await apiFetch<{ id: string; name: string; active: boolean; updatedAt?: string }>(
    n8nUrl(`workflows/${workflowId}`),
  );
  return {
    id: String(data.id),
    name: data.name,
    active: Boolean(data.active),
    updatedAt: data.updatedAt,
  };
}

export async function setWorkflowActive(
  workflowId: string,
  active: boolean,
): Promise<WorkflowStatus> {
  const action = active ? 'activate' : 'deactivate';
  const data = await apiFetch<{ id: string; name: string; active: boolean; updatedAt?: string }>(
    n8nUrl(`workflows/${workflowId}/${action}`),
    { method: 'POST', body: {} },
  );
  return {
    id: String(data.id),
    name: data.name,
    active: Boolean(data.active),
    updatedAt: data.updatedAt,
  };
}

export async function runWorkflow(
  workflowId: string,
  triggerNodeName?: string,
  extras?: Record<string, unknown>,
): Promise<{ executionId: string }> {
  // The proxy intercepts /run (n8n Cloud 405s a bare POST) and forwards to the
  // v2 webhook override (or /execute → discovered webhook).
  const data = await apiFetch<{ executionId?: string; id?: string }>(
    n8nUrl(`workflows/${workflowId}/run`),
    {
      method: 'POST',
      body: {
        ...(triggerNodeName ? { triggerNodeName } : {}),
        ...(extras || {}),
      },
    },
  );
  return { executionId: String(data.executionId ?? data.id ?? '') };
}

/** Fire the Apollo Discovery workflow via its production webhook. */
export async function runApolloDiscovery(
  input: ApolloDiscoveryInput,
): Promise<{ executionId: string }> {
  const cfg = loadConfig();
  return runWorkflow(cfg.apolloWorkflowId, undefined, {
    campaign: input.campaign,
    per_page: input.per_page,
    ...(input.titles?.length ? { titles: input.titles } : {}),
    ...(input.keywords ? { keywords: input.keywords } : {}),
    ...(input.location?.trim() ? { location: input.location.trim() } : {}),
  });
}

export async function listExecutions(workflowId: string, limit = 10): Promise<Execution[]> {
  const data = await apiFetch<{ data?: Array<Record<string, unknown>> }>(
    n8nUrl(`executions?workflowId=${encodeURIComponent(workflowId)}&limit=${limit}`),
  );
  return (data.data ?? []).map((e) => ({
    id: String(e.id),
    workflowId: e.workflowId ? String(e.workflowId) : workflowId,
    status: normalizeStatus(e.status ?? (e.finished ? 'success' : undefined)),
    startedAt: e.startedAt ? String(e.startedAt) : undefined,
    stoppedAt: e.stoppedAt ? String(e.stoppedAt) : undefined,
    mode: e.mode ? String(e.mode) : undefined,
  }));
}

export async function getExecution(executionId: string): Promise<Execution> {
  const e = await apiFetch<Record<string, unknown>>(
    n8nUrl(`executions/${encodeURIComponent(executionId)}?includeData=true`),
  );
  return {
    id: String(e.id),
    workflowId: e.workflowId ? String(e.workflowId) : undefined,
    status: normalizeStatus(e.status ?? (e.finished ? 'success' : undefined)),
    startedAt: e.startedAt ? String(e.startedAt) : undefined,
    stoppedAt: e.stoppedAt ? String(e.stoppedAt) : undefined,
    mode: e.mode ? String(e.mode) : undefined,
    data: e.data ?? e,
  };
}
