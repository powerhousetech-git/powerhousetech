/**
 * n8n Cloud's public API does not accept POST /api/v1/workflows/{id}/run
 * (production returns 405). Run Now therefore tries, in order:
 *   1. Optional webhook URL override (CC_N8N_WEBHOOKS JSON map)
 *   2. POST /api/v1/workflows/{id}/execute  (newer n8n public API)
 *   3. A Webhook trigger discovered on the workflow, posted at /webhook/{path}
 * It never edits workflow nodes.
 */

export interface N8nNode {
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

export function isWebhookTriggerNode(node: N8nNode | undefined): boolean {
  if (!node || node.disabled) return false;
  const type = String(node.type || '');
  return type === 'n8n-nodes-base.webhook' || type.endsWith('.webhook');
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
  if (rec && (rec.executionId || rec.id || rec.data)) {
    return {
      ...rec,
      executionId: rec.executionId ?? rec.id ?? '',
    };
  }
  return { ...fallback, ...(rec || {}) };
}

export async function runN8nWorkflow(opts: {
  baseUrl: string;
  apiKey: string;
  workflowId: string;
  webhookOverride?: string;
  fetchImpl?: typeof fetch;
}): Promise<RunResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const root = opts.baseUrl.replace(/\/$/, '');
  const headers = n8nHeaders(opts.apiKey);
  const payload = JSON.stringify({
    source: 'command-center',
    triggeredAt: new Date().toISOString(),
  });

  if (opts.webhookOverride?.trim()) {
    const url = resolveOverrideWebhookUrl(root, opts.webhookOverride);
    const hookRes = await fetchImpl(url, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: payload,
    });
    const hookBody = await readJson(hookRes);
    if (hookRes.ok) {
      return {
        status: hookRes.status,
        body: normalizeSuccess(hookBody, { started: true, via: 'webhook-override' }),
      };
    }
    // Fall through to execute / discovered webhook if the override URL 404s.
  }

  const executeRes = await fetchImpl(`${root}/api/v1/workflows/${opts.workflowId}/execute`, {
    method: 'POST',
    headers,
    body: '{}',
  });
  const executeBody = await readJson(executeRes);
  if (executeRes.ok) {
    return {
      status: executeRes.status,
      body: normalizeSuccess(executeBody, { started: true, via: 'execute' }),
    };
  }

  const wfRes = await fetchImpl(`${root}/api/v1/workflows/${opts.workflowId}`, {
    method: 'GET',
    headers,
  });
  const wfBody = await readJson(wfRes);
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

  const workflow = (asRecord(wfBody) || {}) as N8nWorkflow;
  const webhook = resolveWebhookUrl(root, workflow.nodes);
  if (webhook) {
    const hookRes = await fetchImpl(webhook.url, {
      method: webhook.method,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: webhook.method === 'GET' ? undefined : payload,
    });
    const hookBody = await readJson(hookRes);
    if (hookRes.ok) {
      return {
        status: hookRes.status,
        body: normalizeSuccess(hookBody, { started: true, via: 'webhook' }),
      };
    }
    const hint = workflow.active
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

  const executeHint =
    asRecord(executeBody)?.message || asRecord(executeBody)?.hint || `HTTP ${executeRes.status}`;
  return {
    status: 409,
    body: {
      error:
        'n8n Cloud does not support POST /workflows/{id}/run, and this workflow has no Webhook trigger. Add a Webhook node in parallel with the Schedule trigger (and keep the workflow active), then click Run Now again.',
      executeAttempt: executeHint,
    },
  };
}
