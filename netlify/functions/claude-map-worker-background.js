const { mapTallyWithClaude } = require('./lib/claude-api');
const { getJob, setJob } = require('./lib/job-store');

exports.handler = async (event) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY missing');
    return { statusCode: 500, body: 'API key not configured' };
  }

  let jobId;
  try {
    jobId = JSON.parse(event.body || '{}').jobId;
  } catch {
    return { statusCode: 400, body: 'Invalid body' };
  }

  if (!jobId) {
    return { statusCode: 400, body: 'jobId required' };
  }

  let job;
  try {
    job = await getJob(jobId, event);
  } catch (err) {
    console.error('getJob failed:', err.message);
    return { statusCode: 500, body: err.message };
  }

  if (!job?.payload) {
    console.error('Job missing payload:', jobId);
    return { statusCode: 404, body: 'Job not found' };
  }

  const { entityName, fyEnd, prevFyEnd, tallyData } = job.payload;

  try {
    await setJob(jobId, {
      ...job,
      status: 'processing',
      message: 'Matching ledgers to Schedule III heads…',
    }, event);

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
    await setJob(jobId, {
      status: 'error',
      error: err.message || 'Mapping failed',
      finishedAt: new Date().toISOString(),
    }, event).catch(() => {});
  }

  return { statusCode: 202, body: JSON.stringify({ jobId, status: 'finished' }) };
};
