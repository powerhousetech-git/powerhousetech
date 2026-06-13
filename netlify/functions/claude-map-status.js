const { getJob } = require('./lib/job-store');

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

function json(statusCode, body) {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(body) };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Method not allowed' });
  }

  const jobId = (event.queryStringParameters?.jobId || '').trim();
  if (!jobId) {
    return json(400, { error: 'jobId query parameter is required' });
  }

  let job;
  try {
    job = await getJob(jobId, event);
  } catch (err) {
    return json(500, { error: err.message || 'Could not read job status' });
  }

  if (!job) {
    return json(200, {
      status: 'processing',
      message: 'Starting conversion…',
    });
  }

  if (job.status === 'done') {
    return json(200, { status: 'done', result: job.result });
  }

  if (job.status === 'error') {
    return json(200, { status: 'error', error: job.error || 'Mapping failed' });
  }

  return json(200, {
    status: job.status || 'processing',
    message: job.message || 'Processing…',
  });
};
