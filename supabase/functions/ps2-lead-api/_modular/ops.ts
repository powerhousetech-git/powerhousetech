import type { SessionUser } from './helpers.ts';
import { handleLeadReadOps } from './ops-leads-read.ts';
import { handleLeadWriteOps } from './ops-leads-write.ts';
import { handleLeadIngestOps } from './ops-leads-ingest.ts';
import { handleMailOps } from './ops-mail.ts';
import { handleAdminOps } from './ops-admin.ts';

export async function handleOps(
  req: Request, op: string, id: string, method: string, user: SessionUser, isN8n: boolean,
): Promise<Response | null> {
  return (
    await handleLeadReadOps(req, op, id, method, user, isN8n)
    ?? await handleLeadWriteOps(req, op, id, method, user, isN8n)
    ?? await handleLeadIngestOps(req, op, id, method, user, isN8n)
    ?? await handleMailOps(req, op, id, method, user, isN8n)
    ?? await handleAdminOps(req, op, id, method, user, isN8n)
  );
}
