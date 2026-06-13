const { mapTallyWithClaude } = require('./lib/claude-api');
const { setJob } = require('./lib/job-store');

exports.handler = async (event) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY missing in background worker');
    return;
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    console.error('Invalid JSON in background worker');
    return;
  }

  const jobId = String(payload.jobId || '').trim();
  if (!jobId) return;

  const entityName = String(payload.entityName || 'Entity Name').slice(0, 500);
  const fyEnd = String(payload.fyEnd || '2026-03-31').slice(0, 32);
  const prevFyEnd = String(payload.prevFyEnd || '2025-03-31').slice(0, 32);
  const tallyData = String(payload.tallyData || '');

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
    }, event);
  } catch (err) {
    console.error('Background mapping failed:', err);
    try {
      await setJob(jobId, {
        status: 'error',
        error: err.message || 'Mapping failed',
        finishedAt: new Date().toISOString(),
      }, event);
    } catch (storeErr) {
      console.error('Could not persist mapping error:', storeErr);
    }
  }
};
