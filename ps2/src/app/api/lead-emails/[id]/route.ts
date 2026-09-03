import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/api-auth';
import { updateLeadEmail } from '@/lib/db';
import { ok, err } from '@/lib/api';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, context: RouteContext) {
  const session = await requireAuthUser(req);
  if (session instanceof Response) return session;

  const { id } = await context.params;

  try {
    const body = await req.json();
    const { status, subject, body: emailBody, action } = body;

    const updates: Record<string, unknown> = {};

    if (action === 'approve') {
      updates.status = 'approved';
    } else if (action === 'reject') {
      updates.status = 'rejected';
    } else if (status) {
      updates.status = status;
    }

    if (subject !== undefined) updates.subject = subject;
    if (emailBody !== undefined) updates.body = emailBody;

    if (Object.keys(updates).length === 0) {
      return err('No valid update fields provided');
    }

    const email = await updateLeadEmail(id, updates);

    if (!email) {
      return err('Lead email not found', 404);
    }

    return ok(email);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to update lead email';
    return err(message, 500);
  }
}
