import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

export type JobPayload = {
  entityName: string;
  fyEnd: string;
  prevFyEnd: string;
  tallyData: string;
};

export type MappingJob = {
  status: 'processing' | 'done' | 'error';
  message?: string;
  payload?: JobPayload;
  result?: Record<string, unknown>;
  error?: string;
  startedAt?: string;
  finishedAt?: string;
  entityName?: string;
  sourceFilename?: string;
};

function adminClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    throw new Error('Supabase service credentials are not configured.');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function setJob(jobId: string, data: MappingJob): Promise<void> {
  const row: Record<string, unknown> = {
    id: jobId,
    status: data.status,
    message: data.message ?? null,
    payload: data.payload ?? null,
    result: data.result ?? null,
    error: data.error ?? null,
    finished_at: data.finishedAt ?? null,
  };

  if (data.startedAt) {
    row.started_at = data.startedAt;
  }

  if (data.entityName) {
    row.entity_name = data.entityName;
  } else if (data.payload?.entityName) {
    row.entity_name = data.payload.entityName;
  }

  if (data.sourceFilename) {
    row.source_filename = data.sourceFilename;
  }

  const { error } = await adminClient()
    .from('mapping_jobs')
    .upsert(row, { onConflict: 'id' });

  if (error) {
    throw new Error('Job storage unavailable: ' + error.message);
  }
}

export async function getJob(jobId: string): Promise<MappingJob | null> {
  const { data, error } = await adminClient()
    .from('mapping_jobs')
    .select('status, message, payload, result, error, started_at, finished_at')
    .eq('id', jobId)
    .maybeSingle();

  if (error) {
    throw new Error('Job storage unavailable: ' + error.message);
  }

  if (!data) return null;

  return {
    status: data.status,
    message: data.message ?? undefined,
    payload: data.payload ?? undefined,
    result: data.result ?? undefined,
    error: data.error ?? undefined,
    startedAt: data.started_at ?? undefined,
    finishedAt: data.finished_at ?? undefined,
  };
}
