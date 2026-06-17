import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { buildBooksWithClaude } from '../_shared/book-build-api.ts';
import { getJob, setJob } from '../_shared/job-store.ts';
import { jsonResponse, optionsResponse } from '../_shared/cors.ts';

async function runBookBuildJob(jobId: string): Promise<void> {
  const job = await getJob(jobId);
  const payload = job?.payload as {
    entityName: string;
    fyEnd: string;
    prevFyEnd: string;
    coaTemplateId: string;
    packData: string;
    dryRun?: boolean;
  } | undefined;

  const dryRun = Boolean(payload?.dryRun);
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!dryRun && !apiKey) {
    await setJob(jobId, {
      status: 'error',
      error: 'ANTHROPIC_API_KEY is not configured on the server.',
      finishedAt: new Date().toISOString(),
      jobKind: 'book_build',
    });
    return;
  }

  if (!payload?.packData) {
    await setJob(jobId, {
      status: 'error',
      error: 'Job not found',
      finishedAt: new Date().toISOString(),
      jobKind: 'book_build',
    });
    return;
  }

  try {
    await setJob(jobId, {
      ...job,
      status: 'processing',
      message: 'Classifying transactions and building working papers…',
      jobKind: 'book_build',
    });

    const result = await buildBooksWithClaude({
      entityName: payload.entityName,
      fyEnd: payload.fyEnd,
      prevFyEnd: payload.prevFyEnd,
      coaTemplateId: payload.coaTemplateId || 'proprietorship-trade',
      packData: payload.packData,
      apiKey: apiKey || '',
      dryRun,
    });

    await setJob(jobId, {
      status: 'done',
      result: result as unknown as Record<string, unknown>,
      finishedAt: new Date().toISOString(),
      jobKind: 'book_build',
    });
  } catch (err) {
    await setJob(jobId, {
      status: 'error',
      error: err instanceof Error ? err.message : 'Book build failed',
      finishedAt: new Date().toISOString(),
      jobKind: 'book_build',
    });
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse();

  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }

  const jobId = String(body.jobId || '').trim();
  if (!jobId || jobId.length > 64) {
    return jsonResponse(400, { error: 'jobId is required' });
  }

  const entityName = String(body.entityName || 'Entity Name').slice(0, 500);
  const fyEnd = String(body.fyEnd || '2026-03-31').slice(0, 32);
  const prevFyEnd = String(body.prevFyEnd || '2025-03-31').slice(0, 32);
  const coaTemplateId = String(body.coaTemplateId || 'proprietorship-trade').slice(0, 64);
  const packData = String(body.packData || '');
  const dryRun = Boolean(body.dryRun);
  const sourceFilename = String(body.sourceFilename || body.filename || '').slice(0, 500);

  if (!packData.trim()) {
    return jsonResponse(400, { error: 'packData is required' });
  }

  if (!dryRun && !Deno.env.get('ANTHROPIC_API_KEY')) {
    return jsonResponse(500, { error: 'ANTHROPIC_API_KEY is not configured on the server.' });
  }

  try {
    await setJob(jobId, {
      status: 'processing',
      message: 'Parsing client pack…',
      jobKind: 'book_build',
      payload: { entityName, fyEnd, prevFyEnd, coaTemplateId, packData, dryRun },
      entityName,
      sourceFilename: sourceFilename || undefined,
      startedAt: new Date().toISOString(),
    });
  } catch (err) {
    return jsonResponse(500, {
      error: err instanceof Error ? err.message : 'Could not create book build job',
    });
  }

  EdgeRuntime.waitUntil(runBookBuildJob(jobId));

  return jsonResponse(202, { jobId, status: 'accepted' });
});
