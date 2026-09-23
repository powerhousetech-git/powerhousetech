/**
 * n8n public REST API (v1) client. Only reads status/executions and triggers
 * runs / (de)activation — it never edits workflow logic.
 *
 * NOTE ON CORS: n8n Cloud does not send permissive CORS headers, so calling the
 * API directly from a browser on a different origin is blocked. In dev we go
 * through the Vite proxy (`/n8n-api`). In production you need a same-origin
 * proxy (serverless function) that forwards to n8n and injects the API key.
 * See README.
 */

import type { Execution, ExecutionStatus, WorkflowStatus } from '../types';
import { loadN8nConfig, type N8nConfig } from './config';

export class N8nApiError extends Error {}

function headers(cfg: N8nConfig): HeadersInit {
  return {
    'X-N8N-API-KEY': cfg.apiKey,
    Accept: 'application/json',
  };
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    if (res.status === 401) {
      throw new N8nApiError('n8n auth failed (401). Check VITE_N8N_API_KEY.');
    }
    throw new N8nApiError(`n8n API error (${res.status}). ${detail}`.trim());
  }
  return (await res.json()) as T;
}

function normalizeStatus(raw: unknown): ExecutionStatus {
  const s = String(raw ?? '').toLowerCase();
  if (s === 'running' || s === 'success' || s === 'error' || s === 'waiting' || s === 'canceled') {
    return s;
  }
  // Older n8n uses `finished`/`stoppedAt` semantics — best-effort mapping.
  if (s === 'finished') return 'success';
  if (s === 'crashed' || s === 'failed') return 'error';
  return 'unknown';
}

export async function getWorkflow(
  workflowId: string,
  config?: N8nConfig,
): Promise<WorkflowStatus> {
  const cfg = config ?? loadN8nConfig();
  const res = await fetch(`${cfg.apiBase}/workflows/${workflowId}`, {
    headers: headers(cfg),
  });
  const data = await handle<{ id: string; name: string; active: boolean; updatedAt?: string }>(res);
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
  config?: N8nConfig,
): Promise<WorkflowStatus> {
  const cfg = config ?? loadN8nConfig();
  const action = active ? 'activate' : 'deactivate';
  const res = await fetch(`${cfg.apiBase}/workflows/${workflowId}/${action}`, {
    method: 'POST',
    headers: headers(cfg),
  });
  const data = await handle<{ id: string; name: string; active: boolean; updatedAt?: string }>(res);
  return {
    id: String(data.id),
    name: data.name,
    active: Boolean(data.active),
    updatedAt: data.updatedAt,
  };
}

export async function runWorkflow(
  workflowId: string,
  config?: N8nConfig,
): Promise<{ executionId: string }> {
  const cfg = config ?? loadN8nConfig();
  const res = await fetch(`${cfg.apiBase}/workflows/${workflowId}/run`, {
    method: 'POST',
    headers: { ...headers(cfg), 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const data = await handle<{ executionId?: string; id?: string }>(res);
  return { executionId: String(data.executionId ?? data.id ?? '') };
}

export async function listExecutions(
  workflowId: string,
  limit = 10,
  config?: N8nConfig,
): Promise<Execution[]> {
  const cfg = config ?? loadN8nConfig();
  const res = await fetch(
    `${cfg.apiBase}/executions?workflowId=${encodeURIComponent(workflowId)}&limit=${limit}`,
    { headers: headers(cfg) },
  );
  const data = await handle<{ data?: Array<Record<string, unknown>> }>(res);
  return (data.data ?? []).map((e) => ({
    id: String(e.id),
    workflowId: e.workflowId ? String(e.workflowId) : workflowId,
    status: normalizeStatus(e.status ?? (e.finished ? 'success' : undefined)),
    startedAt: e.startedAt ? String(e.startedAt) : undefined,
    stoppedAt: e.stoppedAt ? String(e.stoppedAt) : undefined,
    mode: e.mode ? String(e.mode) : undefined,
  }));
}

export async function getExecution(
  executionId: string,
  config?: N8nConfig,
): Promise<Execution> {
  const cfg = config ?? loadN8nConfig();
  const res = await fetch(
    `${cfg.apiBase}/executions/${encodeURIComponent(executionId)}?includeData=true`,
    { headers: headers(cfg) },
  );
  const e = await handle<Record<string, unknown>>(res);
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
