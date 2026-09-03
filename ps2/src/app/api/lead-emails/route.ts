import { NextRequest } from 'next/server';
import {
  getActorId,
  requireJwtOrApiKey,
} from '@/lib/api-auth';
import { createLeadEmail, listLeadEmails } from '@/lib/db';
import { ok, err } from '@/lib/api';

export async function GET(req: NextRequest) {
  const auth = await requireJwtOrApiKey(req);
  if (auth instanceof Response) return auth;

  const { searchParams } = req.nextUrl;
  const leadId = searchParams.get('lead_id');

  if (!leadId) {
    return err('lead_id query parameter is required');
  }

  const emails = await listLeadEmails(leadId);
  return ok(emails);
}

export async function POST(req: NextRequest) {
  const auth = await requireJwtOrApiKey(req);
  if (auth instanceof Response) return auth;

  try {
    const body = await req.json();
    const actorId = getActorId(auth);

    const email = await createLeadEmail({
      lead_id: body.lead_id,
      direction: body.direction ?? 'outbound',
      subject: body.subject ?? '',
      body: body.body ?? '',
      sentiment: body.sentiment ?? null,
      sequence_step: body.sequence_step ?? null,
      status: body.status ?? 'draft',
      is_ai_draft: body.is_ai_draft ?? false,
      sent_at: body.sent_at ?? null,
      received_at: body.received_at ?? null,
      created_by: actorId,
    });

    return ok(email, 201);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to create lead email';
    return err(message, 500);
  }
}
