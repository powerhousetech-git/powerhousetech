const { mapTallyWithClaude } = require('./lib/claude-api');
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

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: JSON_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
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

  await setJob(jobId, {
    status: 'processing',
    message: 'Claude is mapping ledgers to Schedule III heads…',
    startedAt: new Date().toISOString(),
  });

  try {
    const result = await mapTallyWithClaude({
      entityName,
      fyEnd,
      prevFyEnd,
      tallyData,
      apiKey,
    });

    await setJob(jobId, {
      status: 'done',
      result,
      finishedAt: new Date().toISOString(),
    });
  } catch (err) {
    await setJob(jobId, {
      status: 'error',
      error: err.message || 'Mapping failed',
      finishedAt: new Date().toISOString(),
    });
  }

  return json(202, { jobId, status: 'accepted' });
};
