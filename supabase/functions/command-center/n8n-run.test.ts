import assert from 'node:assert/strict';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { test } from 'node:test';
import {
  buildTriggerPayload,
  parseWebhookOverrides,
  parseWorkflowRunPath,
  readTriggerNodeName,
  resolveOverrideWebhookUrl,
  resolveWebhookUrl,
  runN8nWorkflow,
  scheduleTriggerName,
  type N8nNode,
} from './n8n-run.ts';

function listen(handler: (req: IncomingMessage, res: ServerResponse) => void) {
  const server = createServer(handler);
  return new Promise<{ url: string; close: () => Promise<void> }>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number };
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

test('parseWorkflowRunPath accepts run and execute', () => {
  assert.equal(parseWorkflowRunPath('workflows/yrYIauoO1q46DORb/run'), 'yrYIauoO1q46DORb');
  assert.equal(parseWorkflowRunPath('/workflows/abc/execute'), 'abc');
  assert.equal(parseWorkflowRunPath('workflows/abc/activate'), null);
  assert.equal(parseWorkflowRunPath('executions?workflowId=abc'), null);
});

test('readTriggerNodeName parses the Command Center body', () => {
  assert.equal(readTriggerNodeName('{"triggerNodeName":"Daily 8:30 AM IST (Mon-Sat)"}'), 'Daily 8:30 AM IST (Mon-Sat)');
  assert.equal(readTriggerNodeName('{}'), undefined);
  assert.equal(readTriggerNodeName('not-json'), undefined);
});

test('buildTriggerPayload includes triggerToStartFrom', () => {
  assert.equal(buildTriggerPayload(undefined), '{}');
  assert.deepEqual(JSON.parse(buildTriggerPayload('Daily 9 AM EST (Mon-Fri)')), {
    triggerNodeName: 'Daily 9 AM EST (Mon-Fri)',
    triggerToStartFrom: { name: 'Daily 9 AM EST (Mon-Fri)' },
  });
});

test('scheduleTriggerName finds the schedule node', () => {
  const nodes: N8nNode[] = [
    { name: 'Daily 8:30 AM IST (Mon-Sat)', type: 'n8n-nodes-base.scheduleTrigger' },
    { name: 'Send', type: 'n8n-nodes-base.gmail' },
  ];
  assert.equal(scheduleTriggerName(nodes), 'Daily 8:30 AM IST (Mon-Sat)');
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

test('runN8nWorkflow posts triggerNodeName to /execute', async () => {
  let executeBody = '';
  const server = await listen(async (req, res) => {
    const url = req.url || '';
    if (url.endsWith('/execute') && req.method === 'POST') {
      executeBody = await readBody(req);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ executionId: 'exec-9' }));
      return;
    }
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id: 'wf-exec', nodes: [] }));
      return;
    }
    res.writeHead(500).end();
  });
  try {
    const result = await runN8nWorkflow({
      baseUrl: server.url,
      apiKey: 'test-key',
      workflowId: 'wf-exec',
      triggerNodeName: 'Daily 8:30 AM IST (Mon-Sat)',
    });
    assert.equal(result.status, 200);
    assert.equal((result.body as { executionId: string }).executionId, 'exec-9');
    assert.equal(JSON.parse(executeBody).triggerNodeName, 'Daily 8:30 AM IST (Mon-Sat)');
  } finally {
    await server.close();
  }
});

test('runN8nWorkflow falls back to /run with triggerNodeName when /execute is 405', async () => {
  const hits: string[] = [];
  let runBody = '';
  const server = await listen(async (req, res) => {
    const url = req.url || '';
    hits.push(`${req.method} ${url}`);
    if (url.endsWith('/execute')) {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Method Not Allowed' }));
      return;
    }
    if (url.endsWith('/run') && req.method === 'POST') {
      runBody = await readBody(req);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ executionId: 'exec-run' }));
      return;
    }
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id: 'wf-run', nodes: [{ name: 'Daily 9 AM EST (Mon-Fri)', type: 'n8n-nodes-base.scheduleTrigger' }] }));
      return;
    }
    res.writeHead(404).end();
  });
  try {
    const result = await runN8nWorkflow({
      baseUrl: server.url,
      apiKey: 'test-key',
      workflowId: 'wf-run',
      triggerNodeName: 'Daily 9 AM EST (Mon-Fri)',
    });
    assert.equal(result.status, 200);
    assert.equal((result.body as { executionId: string }).executionId, 'exec-run');
    assert.equal(JSON.parse(runBody).triggerNodeName, 'Daily 9 AM EST (Mon-Fri)');
  } finally {
    await server.close();
  }
});

test('runN8nWorkflow falls back from 405 /execute to the discovered webhook', async () => {
  const hits: string[] = [];
  const server = await listen((req, res) => {
    const url = req.url || '';
    hits.push(`${req.method} ${url}`);
    if (url.endsWith('/execute') || url.endsWith('/run')) {
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
            { type: 'n8n-nodes-base.scheduleTrigger', name: 'Daily 8:30 AM IST (Mon-Sat)' },
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
  try {
    const result = await runN8nWorkflow({
      baseUrl: server.url,
      apiKey: 'test-key',
      workflowId: 'wf1',
    });
    assert.equal(result.status, 200);
    const body = result.body as { started?: boolean; via?: string };
    assert.equal(body.via, 'webhook');
    assert.ok(hits.includes('POST /api/v1/workflows/wf1/execute'));
    assert.ok(hits.includes('POST /webhook/india-run'));
  } finally {
    await server.close();
  }
});

test('runN8nWorkflow errors clearly when execute/run fail and there is no webhook', async () => {
  const server = await listen((req, res) => {
    if (String(req.url).endsWith('/execute') || String(req.url).endsWith('/run')) {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Method Not Allowed' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        id: 'wf2',
        active: true,
        nodes: [{ name: 'Daily 8:30 AM IST (Mon-Sat)', type: 'n8n-nodes-base.scheduleTrigger' }],
      }),
    );
  });
  try {
    const result = await runN8nWorkflow({
      baseUrl: server.url,
      apiKey: 'test-key',
      workflowId: 'wf2',
      triggerNodeName: 'Daily 8:30 AM IST (Mon-Sat)',
    });
    assert.equal(result.status, 409);
    const body = result.body as { error: string };
    assert.match(body.error, /Daily 8:30 AM IST \(Mon-Sat\)/);
  } finally {
    await server.close();
  }
});
