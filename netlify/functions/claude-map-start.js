const { setJob } = require('./lib/job-store');

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(statusCode, body) {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(body) };
}

function workerUrl() {
  const base = process.env.URL || process.env.DEPLOY_PRIME_URL || 'http://localhost:8888';
  return `${base}/.netlify/functions/claude-map-worker-background`;
}

async function triggerWorker(jobId) {
  try {
    await fetch(workerUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId }),
    });
  } catch (err) {
    console.error('Worker trigger failed:', err.message);
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: JSON_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return json(500, { error: 'ANTHROPIC_API_KEY is not configured on the server.' });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  const jobId = String(payload.jobId || '').trim();
  if (!jobId || jobId.length > 64) {
    return json(400, { error: 'jobId is required' });
  }

  const entityName = String(payload.entityName || 'Entity Name').slice(0, 500);
  const fyEnd = String(payload.fyEnd || '2026-03-31').slice(0, 32);
  const prevFyEnd = String(payload.prevFyEnd || '2025-03-31').slice(0, 32);
  const tallyData = String(payload.tallyData || '');

  if (!tallyData.trim()) {
    return json(400, { error: 'tallyData is required' });
  }

  try {
    await setJob(jobId, {
      status: 'processing',
      message: 'Matching ledgers to Schedule III heads…',
      payload: { entityName, fyEnd, prevFyEnd, tallyData },
      startedAt: new Date().toISOString(),
    }, event);
  } catch (err) {
    return json(500, { error: err.message || 'Could not create mapping job' });
  }

  await triggerWorker(jobId);

  return json(202, { jobId, status: 'accepted' });
};
