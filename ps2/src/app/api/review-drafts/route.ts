import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/api-auth';
import { getLead, listLeadEmails } from '@/lib/db';
import { ok, err } from '@/lib/api';

export async function GET(req: NextRequest) {
  const session = await requireAuthUser(req);
  if (session instanceof Response) return session;

  try {
    const { searchParams } = req.nextUrl;
    const assignedTo = searchParams.get('assigned_to') ?? undefined;

    const emails = await listLeadEmails(undefined, 'pending_review');
    const drafts = await Promise.all(
      emails.map(async (email) => {
        const lead = await getLead(email.lead_id);
        if (!lead) return null;
        if (assignedTo && lead.assigned_to !== assignedTo) return null;
        return { ...email, lead };
      })
    );

    return ok(drafts.filter(Boolean));
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load review drafts';
    return err(message, 500);
  }
}
