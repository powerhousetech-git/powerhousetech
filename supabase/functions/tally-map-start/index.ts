import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { mapTallyWithClaude } from '../_shared/claude-api.ts';
import { getJob, setJob } from '../_shared/job-store.ts';
import { jsonResponse, optionsResponse } from '../_shared/cors.ts';

async function runMappingJob(jobId: string): Promise<void> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    await setJob(jobId, {
      status: 'error',
      error: 'ANTHROPIC_API_KEY is not configured on the server.',
      finishedAt: new Date().toISOString(),
    });
    return;
  }

  const job = await getJob(jobId);
  if (!job?.payload) {
    await setJob(jobId, {
      status: 'error',
      error: 'Job not found',
      finishedAt: new Date().toISOString(),
    });
    return;
  }

  const { entityName, fyEnd, prevFyEnd, tallyData } = job.payload;

  try {
    await setJob(jobId, {
      ...job,
      status: 'processing',
      message: 'Matching ledgers to Schedule III heads…',
    });

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
      error: err instanceof Error ? err.message : 'Mapping failed',
      finishedAt: new Date().toISOString(),
    });
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse();

  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  if (!Deno.env.get('ANTHROPIC_API_KEY')) {
    return jsonResponse(500, { error: 'ANTHROPIC_API_KEY is not configured on the server.' });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }

  const jobId = String(payload.jobId || '').trim();
  if (!jobId || jobId.length > 64) {
    return jsonResponse(400, { error: 'jobId is required' });
  }

  const entityName = String(payload.entityName || 'Entity Name').slice(0, 500);
  const fyEnd = String(payload.fyEnd || '2026-03-31').slice(0, 32);
  const prevFyEnd = String(payload.prevFyEnd || '2025-03-31').slice(0, 32);
  const tallyData = String(payload.tallyData || '');
  const sourceFilename = String(payload.sourceFilename || payload.filename || '').slice(0, 500);

  if (!tallyData.trim()) {
    return jsonResponse(400, { error: 'tallyData is required' });
  }

  try {
    await setJob(jobId, {
      status: 'processing',
      message: 'Matching ledgers to Schedule III heads…',
      payload: { entityName, fyEnd, prevFyEnd, tallyData },
      entityName,
      sourceFilename: sourceFilename || undefined,
      startedAt: new Date().toISOString(),
    });
  } catch (err) {
    return jsonResponse(500, {
      error: err instanceof Error ? err.message : 'Could not create mapping job',
    });
  }

  EdgeRuntime.waitUntil(runMappingJob(jobId));

  return jsonResponse(202, { jobId, status: 'accepted' });
});
