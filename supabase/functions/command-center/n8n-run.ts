/**
 * n8n Cloud's public API does not accept an empty POST /api/v1/workflows/{id}/run
 * (production returned 405). Run Now therefore:
 *   1. Optional webhook URL override (CC_N8N_WEBHOOKS JSON map)
 *   2. POST /api/v1/workflows/{id}/execute with triggerNodeName
 *   3. POST /api/v1/workflows/{id}/run with triggerNodeName (some n8n builds)
 *   4. A Webhook trigger discovered on the workflow
 * It never edits workflow nodes.
 */

export interface N8nNode {
  name?: string;
  type?: string;
  disabled?: boolean;
  webhookId?: string;
  parameters?: {
    path?: string;
    httpMethod?: string;
  };
}

export interface N8nWorkflow {
  id?: string;
  name?: string;
  active?: boolean;
  nodes?: N8nNode[];
}

export interface RunResult {
  status: number;
  body: unknown;
}

export function parseWorkflowRunPath(path: string): string | null {
  const cleaned = String(path || '').replace(/^\//, '').split('?')[0] ?? '';
  const match = cleaned.match(/^workflows\/([^/]+)\/(run|execute)\/?$/);
  return match?.[1] ?? null;
}

export function readTriggerNodeName(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return undefined;
  try {
    const parsed = JSON.parse(raw) as { triggerNodeName?: unknown };
    if (typeof parsed.triggerNodeName === 'string' && parsed.triggerNodeName.trim()) {
      return parsed.triggerNodeName.trim();
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export function isWebhookTriggerNode(node: N8nNode | undefined): boolean {
  if (!node || node.disabled) return false;
  const type = String(node.type || '');
  return type === 'n8n-nodes-base.webhook' || type.endsWith('.webhook');
}

export function isScheduleTriggerNode(node: N8nNode | undefined): boolean {
  if (!node || node.disabled) return false;
  const type = String(node.type || '').toLowerCase();
  return type.includes('scheduletrigger') || type.endsWith('.cron') || type.endsWith('.interval');
}

export function scheduleTriggerName(nodes: N8nNode[] | undefined): string | undefined {
  const node = (nodes || []).find(isScheduleTriggerNode);
  const name = node?.name?.trim();
  return name || undefined;
}

export function webhookPathFromNode(node: N8nNode): string | null {
  const fromParams = String(node.parameters?.path || '').trim().replace(/^\//, '');
  if (fromParams) return fromParams;
  const fromId = String(node.webhookId || '').trim();
  return fromId || null;
}

export function resolveWebhookUrl(
  baseUrl: string,
  nodes: N8nNode[] | undefined,
): { url: string; method: string } | null {
  const node = (nodes || []).find(isWebhookTriggerNode);
  if (!node) return null;
  const path = webhookPathFromNode(node);
  if (!path) return null;
  const method = String(node.parameters?.httpMethod || 'POST').toUpperCase();
  const root = baseUrl.replace(/\/$/, '');
  return { url: `${root}/webhook/${path}`, method };
}

export function resolveOverrideWebhookUrl(
  baseUrl: string,
  override: string,
): string {
  const value = override.trim();
  if (/^https?:\/\//i.test(value)) return value;
  const root = baseUrl.replace(/\/$/, '');
  if (value.startsWith('/')) return `${root}${value}`;
  return `${root}/webhook/${value.replace(/^\//, '')}`;
}

export function parseWebhookOverrides(raw: string | undefined): Record<string, string> {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'string' && value.trim()) out[key] = value.trim();
    }
    return out;
  } catch {
    return {};
  }
}

/** Production webhook paths Claude added on the India/US outreach workflows. */
export const DEFAULT_WEBHOOK_PATHS: Record<string, string> = {
  yrYIauoO1q46DORb: 'run-india-outreach',
  '41O5a05zrxyWqpe2': 'run-us-outreach',
};

export function webhookOverrideFor(
  workflowId: string,
  envOverrides: Record<string, string>,
): string | undefined {
  return envOverrides[workflowId] || DEFAULT_WEBHOOK_PATHS[workflowId];
}

export function buildTriggerPayload(triggerNodeName?: string): string {
  if (!triggerNodeName) return '{}';
  return JSON.stringify({
    triggerNodeName,
    triggerToStartFrom: { name: triggerNodeName },
  });
}

/** Body used by the n8n editor: POST /rest/workflows/{id}/run */
export function buildRestRunPayload(
  workflow: N8nWorkflow | null,
  triggerNodeName?: string,
): string {
  const payload: Record<string, unknown> = {};
  if (workflow) payload.workflowData = workflow;
  if (triggerNodeName) {
    payload.triggerNodeName = triggerNodeName;
    payload.triggerToStartFrom = { name: triggerNodeName };
    payload.startNodes = [{ name: triggerNodeName }];
  }
  return JSON.stringify(payload);
}

function n8nHeaders(apiKey: string): Record<string, string> {
  return {
    'X-N8N-API-KEY': apiKey,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeSuccess(body: unknown, fallback: Record<string, unknown>): unknown {
  const rec = asRecord(body);
  const inner = rec && asRecord(rec.data) ? asRecord(rec.data) : rec;
  if (inner && (inner.executionId || inner.id)) {
    return {
      ...inner,
      ...fallback,
      executionId: inner.executionId ?? inner.id ?? '',
    };
  }
  if (rec && (rec.executionId || rec.id || rec.data)) {
    return {
      ...rec,
      ...fallback,
      executionId: rec.executionId ?? rec.id ?? '',
    };
  }
  return { ...fallback, ...(rec || {}) };
}

async function postJson(
  fetchImpl: typeof fetch,
  url: string,
  headers: Record<string, string>,
  body: string,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const res = await fetchImpl(url, { method: 'POST', headers, body });
  return { ok: res.ok, status: res.status, body: await readJson(res) };
}

export async function runN8nWorkflow(opts: {
  baseUrl: string;
  apiKey: string;
  workflowId: string;
  triggerNodeName?: string;
  webhookOverride?: string;
  fetchImpl?: typeof fetch;
}): Promise<RunResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const root = opts.baseUrl.replace(/\/$/, '');
  const headers = n8nHeaders(opts.apiKey);
  const webhookPayload = JSON.stringify({
    source: 'command-center',
    triggeredAt: new Date().toISOString(),
    triggerNodeName: opts.triggerNodeName || undefined,
  });

  if (opts.webhookOverride?.trim()) {
    const url = resolveOverrideWebhookUrl(root, opts.webhookOverride);
    const hookRes = await fetchImpl(url, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: webhookPayload,
    });
    const hookBody = await readJson(hookRes);
    if (hookRes.ok) {
      return {
        status: hookRes.status,
        body: normalizeSuccess(hookBody, { started: true, via: 'webhook-override' }),
      };
    }
  }

  const wfRes = await fetchImpl(`${root}/api/v1/workflows/${opts.workflowId}`, {
    method: 'GET',
    headers,
  });
  const wfBody = await readJson(wfRes);
  const workflow = wfRes.ok ? ((asRecord(wfBody) || {}) as N8nWorkflow) : null;
  const triggerNodeName =
    opts.triggerNodeName?.trim() || scheduleTriggerName(workflow?.nodes);

  const triggerBody = buildTriggerPayload(triggerNodeName);

  const execute = await postJson(
    fetchImpl,
    `${root}/api/v1/workflows/${opts.workflowId}/execute`,
    headers,
    triggerBody,
  );
  if (execute.ok) {
    return {
      status: execute.status,
      body: normalizeSuccess(execute.body, { started: true, via: 'execute' }),
    };
  }

  const run = await postJson(
    fetchImpl,
    `${root}/api/v1/workflows/${opts.workflowId}/run`,
    headers,
    triggerBody,
  );
  if (run.ok) {
    return {
      status: run.status,
      body: normalizeSuccess(run.body, { started: true, via: 'run' }),
    };
  }

  // n8n editor endpoint — Cloud's public /api/v1 has no execute/run (405).
  const restBody = buildRestRunPayload(workflow, triggerNodeName);
  const restById = await postJson(
    fetchImpl,
    `${root}/rest/workflows/${opts.workflowId}/run`,
    headers,
    restBody,
  );
  if (restById.ok) {
    return {
      status: restById.status,
      body: normalizeSuccess(restById.body, { started: true, via: 'rest' }),
    };
  }
  const restGlobal = await postJson(
    fetchImpl,
    `${root}/rest/workflows/run`,
    headers,
    restBody,
  );
  if (restGlobal.ok) {
    return {
      status: restGlobal.status,
      body: normalizeSuccess(restGlobal.body, { started: true, via: 'rest' }),
    };
  }

  if (!wfRes.ok) {
    return {
      status: wfRes.status,
      body: {
        error:
          (asRecord(wfBody)?.message as string) ||
          (asRecord(wfBody)?.error as string) ||
          `Could not load n8n workflow (${wfRes.status}).`,
      },
    };
  }

  const webhook = resolveWebhookUrl(root, workflow?.nodes);
  if (webhook) {
    const hookRes = await fetchImpl(webhook.url, {
      method: webhook.method,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: webhook.method === 'GET' ? undefined : webhookPayload,
    });
    const hookBody = await readJson(hookRes);
    if (hookRes.ok) {
      return {
        status: hookRes.status,
        body: normalizeSuccess(hookBody, { started: true, via: 'webhook' }),
      };
    }
    const hint = workflow?.active
      ? `Webhook ${webhook.method} ${webhook.url} failed (${hookRes.status}).`
      : 'This workflow has a Webhook trigger but is inactive, so the production webhook is not registered. Activate it, then click Run Now.';
    return {
      status: hookRes.status === 404 ? 409 : hookRes.status,
      body: {
        error: hint,
        message: asRecord(hookBody)?.message,
      },
    };
  }

  const hintOf = (result: { status: number; body: unknown }) =>
    asRecord(result.body)?.message || asRecord(result.body)?.hint || `HTTP ${result.status}`;
  return {
    status: 409,
    body: {
      error:
        'n8n Cloud cannot start a schedule-only workflow from the dashboard. Add a Webhook node on India (yrYIauoO1q46DORb) and US (41O5a05zrxyWqpe2) in parallel with the Schedule trigger — same outgoing connection, POST, path india-outreach-run / us-outreach-run, no extra auth — then keep the workflow Active and click Run Now.',
      executeAttempt: hintOf(execute),
      runAttempt: hintOf(run),
      restAttempt: `${hintOf(restById)} / ${hintOf(restGlobal)}`,
    },
  };
}
