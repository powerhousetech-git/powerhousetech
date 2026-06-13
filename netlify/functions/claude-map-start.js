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

function parsePayload(event) {
  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { error: json(400, { error: 'Invalid JSON body' }) };
  }

  const jobId = String(payload.jobId || '').trim();
  if (!jobId || jobId.length > 64) {
    return { error: json(400, { error: 'jobId is required' }) };
  }

  const entityName = String(payload.entityName || 'Entity Name').slice(0, 500);
  const fyEnd = String(payload.fyEnd || '2026-03-31').slice(0, 32);
  const prevFyEnd = String(payload.prevFyEnd || '2025-03-31').slice(0, 32);
  const tallyData = String(payload.tallyData || '');

  if (!tallyData.trim()) {
    return { error: json(400, { error: 'tallyData is required' }) };
  }

  return { jobId, entityName, fyEnd, prevFyEnd, tallyData, body: event.body };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: JSON_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const parsed = parsePayload(event);
  if (parsed.error) return parsed.error;

  const { jobId, body } = parsed;

  try {
    await setJob(jobId, {
      status: 'processing',
      message: 'Claude is mapping ledgers to Schedule III heads…',
      startedAt: new Date().toISOString(),
    }, event);
  } catch (err) {
    return json(500, { error: err.message || 'Could not create mapping job' });
  }

  const base = process.env.URL || process.env.DEPLOY_PRIME_URL || 'http://localhost:8888';
  fetch(`${base}/.netlify/functions/claude-map-background`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  }).catch(async (err) => {
    console.error('Background worker invoke failed:', err);
    try {
      await setJob(jobId, {
        status: 'error',
        error: 'Could not start the background mapping worker.',
        finishedAt: new Date().toISOString(),
      }, event);
    } catch (storeErr) {
      console.error('Could not persist worker error:', storeErr);
    }
  });

  return json(202, { jobId, status: 'accepted' });
};
