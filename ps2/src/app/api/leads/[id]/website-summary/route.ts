import { NextRequest } from 'next/server';
import { getActorId, requireJwtOrApiKey } from '@/lib/api-auth';
import { updateLead } from '@/lib/db';
import { ok, err } from '@/lib/api';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, context: RouteContext) {
  const auth = await requireJwtOrApiKey(req);
  if (auth instanceof Response) return auth;

  const { id } = await context.params;
  getActorId(auth);

  try {
    const body = await req.json();
    const { website_summary } = body;

    if (website_summary === undefined) {
      return err('website_summary is required');
    }

    const lead = await updateLead(id, { website_summary });

    if (!lead) {
      return err('Lead not found', 404);
    }

    return ok(lead);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to update website summary';
    return err(message, 500);
  }
}
