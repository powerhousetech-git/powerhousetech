import assert from 'node:assert/strict';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { test } from 'node:test';
import {
  buildTriggerPayload,
  parseWebhookOverrides,
  parseWorkflowRunPath,
  readTriggerNodeName,
  readWebhookExtras,
  resolveOverrideWebhookUrl,
  resolveWebhookUrl,
  runN8nWorkflow,
  scheduleTriggerName,
  webhookOverrideFor,
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
  assert.equal(parseWorkflowRunPath('workflows/c2JyDKolZaIhUlzs/run'), 'c2JyDKolZaIhUlzs');
  assert.equal(parseWorkflowRunPath('/workflows/abc/execute'), 'abc');
  assert.equal(parseWorkflowRunPath('workflows/abc/activate'), null);
  assert.equal(parseWorkflowRunPath('executions?workflowId=abc'), null);
});

test('readTriggerNodeName parses the Command Center body', () => {
  assert.equal(readTriggerNodeName('{"triggerNodeName":"Daily India Outreach"}'), 'Daily India Outreach');
  assert.equal(readTriggerNodeName('{}'), undefined);
  assert.equal(readTriggerNodeName('not-json'), undefined);
});

test('readWebhookExtras strips triggerNodeName and keeps Apollo fields', () => {
  assert.deepEqual(
    readWebhookExtras('{"triggerNodeName":"x","per_page":25,"location":"India"}'),
    { per_page: 25, location: 'India' },
  );
  assert.deepEqual(readWebhookExtras('{}'), {});
  assert.deepEqual(readWebhookExtras('not-json'), {});
});

test('webhookOverrideFor prefers env then v2 defaults', () => {
  assert.equal(webhookOverrideFor('c2JyDKolZaIhUlzs', {}), 'run-india-outreach-v2');
  assert.equal(webhookOverrideFor('fHFG8B2mhToK6bid', {}), 'run-us-outreach-v2');
  assert.equal(webhookOverrideFor('lMK8RlkBJS4V8aAH', {}), 'run-apollo-discovery');
  assert.equal(
    webhookOverrideFor('c2JyDKolZaIhUlzs', { c2JyDKolZaIhUlzs: 'custom-india' }),
    'custom-india',
  );
});

test('buildTriggerPayload includes triggerToStartFrom', () => {
  assert.equal(buildTriggerPayload(undefined), '{}');
  assert.deepEqual(JSON.parse(buildTriggerPayload('Daily US Outreach')), {
    triggerNodeName: 'Daily US Outreach',
    triggerToStartFrom: { name: 'Daily US Outreach' },
  });
});

test('scheduleTriggerName finds the schedule node', () => {
  const nodes: N8nNode[] = [
    { name: 'Daily India Outreach', type: 'n8n-nodes-base.scheduleTrigger' },
    { name: 'Send', type: 'n8n-nodes-base.gmail' },
  ];
  assert.equal(scheduleTriggerName(nodes), 'Daily India Outreach');
});

test('resolveWebhookUrl prefers the webhook node path', () => {
  const nodes: N8nNode[] = [
    { type: 'n8n-nodes-base.scheduleTrigger', parameters: {} },
    {
      type: 'n8n-nodes-base.webhook',
      webhookId: 'uuid-1',
      parameters: { path: 'run-india-outreach-v2', httpMethod: 'POST' },
    },
  ];
  assert.deepEqual(resolveWebhookUrl('https://example.app.n8n.cloud/', nodes), {
    url: 'https://example.app.n8n.cloud/webhook/run-india-outreach-v2',
    method: 'POST',
  });
});

test('resolveWebhookUrl skips disabled webhook nodes', () => {
  const nodes: N8nNode[] = [
    { type: 'n8n-nodes-base.webhook', disabled: true, parameters: { path: 'off' } },
  ];
  assert.equal(resolveWebhookUrl('https://example.app.n8n.cloud', nodes), null);
});

test('parseWebhookOverrides ignores invalid JSON', () => {
  assert.deepEqual(parseWebhookOverrides('not-json'), {});
  assert.deepEqual(parseWebhookOverrides('{"c2JyDKolZaIhUlzs":"india-run"}'), {
    c2JyDKolZaIhUlzs: 'india-run',
  });
});

test('resolveOverrideWebhookUrl accepts path or absolute URL', () => {
  assert.equal(
    resolveOverrideWebhookUrl('https://n8n.example', 'run-india-outreach-v2'),
    'https://n8n.example/webhook/run-india-outreach-v2',
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
      triggerNodeName: 'Daily India Outreach',
    });
    assert.equal(result.status, 200);
    assert.equal((result.body as { executionId: string }).executionId, 'exec-9');
    assert.equal(JSON.parse(executeBody).triggerNodeName, 'Daily India Outreach');
  } finally {
    await server.close();
  }
});

test('runN8nWorkflow webhook override receives Apollo extras', async () => {
  let hookBody = '';
  const server = await listen(async (req, res) => {
    if ((req.url || '').includes('/webhook/run-apollo-discovery') && req.method === 'POST') {
      hookBody = await readBody(req);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Workflow got started.' }));
      return;
    }
    res.writeHead(404).end();
  });
  try {
    const result = await runN8nWorkflow({
      baseUrl: server.url,
      apiKey: 'test-key',
      workflowId: 'lMK8RlkBJS4V8aAH',
      webhookOverride: 'run-apollo-discovery',
      webhookExtras: { per_page: 25, location: 'India' },
    });
    assert.equal(result.status, 200);
    const parsed = JSON.parse(hookBody);
    assert.equal(parsed.per_page, 25);
    assert.equal(parsed.location, 'India');
    assert.equal(parsed.source, 'command-center');
  } finally {
    await server.close();
  }
});

test('runN8nWorkflow falls back to /run with triggerNodeName when /execute is 405', async () => {
  let runBody = '';
  const server = await listen(async (req, res) => {
    const url = req.url || '';
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
      res.end(
        JSON.stringify({
          id: 'wf-run',
          nodes: [{ name: 'Daily US Outreach', type: 'n8n-nodes-base.scheduleTrigger' }],
        }),
      );
      return;
    }
    res.writeHead(404).end();
  });
  try {
    const result = await runN8nWorkflow({
      baseUrl: server.url,
      apiKey: 'test-key',
      workflowId: 'wf-run',
      triggerNodeName: 'Daily US Outreach',
    });
    assert.equal(result.status, 200);
    assert.equal((result.body as { executionId: string }).executionId, 'exec-run');
    assert.equal(JSON.parse(runBody).triggerNodeName, 'Daily US Outreach');
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
            { type: 'n8n-nodes-base.scheduleTrigger', name: 'Daily India Outreach' },
            {
              type: 'n8n-nodes-base.webhook',
              parameters: { path: 'run-india-outreach-v2', httpMethod: 'POST' },
            },
          ],
        }),
      );
      return;
    }
    if (url === '/webhook/run-india-outreach-v2' && req.method === 'POST') {
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
    assert.ok(hits.includes('POST /webhook/run-india-outreach-v2'));
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
        nodes: [{ name: 'Daily India Outreach', type: 'n8n-nodes-base.scheduleTrigger' }],
      }),
    );
  });
  try {
    const result = await runN8nWorkflow({
      baseUrl: server.url,
      apiKey: 'test-key',
      workflowId: 'wf2',
      triggerNodeName: 'Daily India Outreach',
    });
    assert.equal(result.status, 409);
    const body = result.body as { error: string };
    assert.match(body.error, /Daily India Outreach/);
  } finally {
    await server.close();
  }
});
