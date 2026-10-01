import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, test } from 'node:test';
import {
  parseWebhookOverrides,
  parseWorkflowRunPath,
  resolveOverrideWebhookUrl,
  resolveWebhookUrl,
  runN8nWorkflow,
  type N8nNode,
} from './n8n-run.ts';

test('parseWorkflowRunPath accepts run and execute', () => {
  assert.equal(parseWorkflowRunPath('workflows/yrYIauoO1q46DORb/run'), 'yrYIauoO1q46DORb');
  assert.equal(parseWorkflowRunPath('/workflows/abc/execute'), 'abc');
  assert.equal(parseWorkflowRunPath('workflows/abc/activate'), null);
  assert.equal(parseWorkflowRunPath('executions?workflowId=abc'), null);
});

test('resolveWebhookUrl prefers the webhook node path', () => {
  const nodes: N8nNode[] = [
    { type: 'n8n-nodes-base.scheduleTrigger', parameters: {} },
    {
      type: 'n8n-nodes-base.webhook',
      webhookId: 'uuid-1',
      parameters: { path: 'india-outreach-run', httpMethod: 'POST' },
    },
    { type: 'n8n-nodes-base.respondToWebhook', parameters: {} },
  ];
  assert.deepEqual(resolveWebhookUrl('https://example.app.n8n.cloud/', nodes), {
    url: 'https://example.app.n8n.cloud/webhook/india-outreach-run',
    method: 'POST',
  });
});

test('resolveWebhookUrl skips disabled webhook nodes', () => {
  const nodes: N8nNode[] = [
    {
      type: 'n8n-nodes-base.webhook',
      disabled: true,
      parameters: { path: 'off' },
    },
  ];
  assert.equal(resolveWebhookUrl('https://example.app.n8n.cloud', nodes), null);
});

test('parseWebhookOverrides ignores invalid JSON', () => {
  assert.deepEqual(parseWebhookOverrides('not-json'), {});
  assert.deepEqual(parseWebhookOverrides('{"yrYIauoO1q46DORb":"india-run"}'), {
    yrYIauoO1q46DORb: 'india-run',
  });
});

test('resolveOverrideWebhookUrl accepts path or absolute URL', () => {
  assert.equal(
    resolveOverrideWebhookUrl('https://n8n.example', 'india-run'),
    'https://n8n.example/webhook/india-run',
  );
  assert.equal(
    resolveOverrideWebhookUrl('https://n8n.example', 'https://n8n.example/webhook/custom'),
    'https://n8n.example/webhook/custom',
  );
});

const hits: string[] = [];
const server = createServer((req, res) => {
  const url = req.url || '';
  hits.push(`${req.method} ${url}`);
  if (url.endsWith('/execute') && req.method === 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Method Not Allowed' }));
    return;
  }
  if (url.includes('/api/v1/workflows/') && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        id: 'wf1',
        active: true,
        nodes: [
          { type: 'n8n-nodes-base.scheduleTrigger' },
          { type: 'n8n-nodes-base.webhook', parameters: { path: 'india-run', httpMethod: 'POST' } },
        ],
      }),
    );
    return;
  }
  if (url === '/webhook/india-run' && req.method === 'POST') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Workflow got started.' }));
    return;
  }
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ message: 'Not Found' }));
});

await new Promise<void>((resolve) => {
  server.listen(0, '127.0.0.1', () => resolve());
});
const { port } = server.address() as { port: number };
const baseUrl = `http://127.0.0.1:${port}`;

after(() => server.close());

test('runN8nWorkflow uses /execute when the public API supports it', async () => {
  const local = createServer((req, res) => {
    if (String(req.url).endsWith('/execute') && req.method === 'POST') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ executionId: 'exec-9' }));
      return;
    }
    res.writeHead(500).end();
  });
  await new Promise<void>((resolve) => local.listen(0, '127.0.0.1', () => resolve()));
  const localPort = (local.address() as { port: number }).port;
  try {
    const result = await runN8nWorkflow({
      baseUrl: `http://127.0.0.1:${localPort}`,
      apiKey: 'test-key',
      workflowId: 'wf-exec',
    });
    assert.equal(result.status, 200);
    assert.equal((result.body as { executionId: string }).executionId, 'exec-9');
  } finally {
    local.close();
  }
});

test('runN8nWorkflow falls back from 405 /execute to the discovered webhook', async () => {
  hits.length = 0;
  const result = await runN8nWorkflow({
    baseUrl,
    apiKey: 'test-key',
    workflowId: 'wf1',
  });
  assert.equal(result.status, 200);
  const body = result.body as { started?: boolean; via?: string };
  assert.equal(body.via, 'webhook');
  assert.equal(body.started, true);
  assert.ok(hits.includes('POST /api/v1/workflows/wf1/execute'));
  assert.ok(hits.includes('POST /webhook/india-run'));
});

test('runN8nWorkflow errors clearly when no webhook exists and execute fails', async () => {
  const localHits: string[] = [];
  const local = createServer((req, res) => {
    localHits.push(`${req.method} ${req.url}`);
    if (String(req.url).endsWith('/execute')) {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Method Not Allowed' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ id: 'wf2', active: true, nodes: [{ type: 'n8n-nodes-base.scheduleTrigger' }] }));
  });
  await new Promise<void>((resolve) => local.listen(0, '127.0.0.1', () => resolve()));
  const localPort = (local.address() as { port: number }).port;
  try {
    const result = await runN8nWorkflow({
      baseUrl: `http://127.0.0.1:${localPort}`,
      apiKey: 'test-key',
      workflowId: 'wf2',
    });
    assert.equal(result.status, 409);
    const body = result.body as { error: string };
    assert.match(body.error, /no Webhook trigger/i);
  } finally {
    local.close();
  }
});
