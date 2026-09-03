import { NextRequest } from 'next/server';
import {
  getActorId,
  requireAuthUser,
  requireJwtOrApiKey,
} from '@/lib/api-auth';
import { deleteLead, getLead, updateLead } from '@/lib/db';
import { ok, err } from '@/lib/api';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  const auth = await requireJwtOrApiKey(req);
  if (auth instanceof Response) return auth;

  const { id } = await context.params;
  const lead = await getLead(id);

  if (!lead) {
    return err('Lead not found', 404);
  }

  return ok(lead);
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const auth = await requireJwtOrApiKey(req);
  if (auth instanceof Response) return auth;

  const { id } = await context.params;
  getActorId(auth);

  try {
    const body = await req.json();
    const lead = await updateLead(id, body);
    if (!lead) {
      return err('Lead not found', 404);
    }
    return ok(lead);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to update lead';
    return err(message, 500);
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const session = await requireAuthUser(req);
  if (session instanceof Response) return session;

  const { id } = await context.params;

  try {
    const deleted = await deleteLead(id);
    if (!deleted) {
      return err('Lead not found', 404);
    }
    return ok({ deleted: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to delete lead';
    return err(message, 500);
  }
}
