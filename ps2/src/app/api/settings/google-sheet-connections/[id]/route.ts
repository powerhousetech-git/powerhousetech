import { NextRequest } from 'next/server';
import { assertNotPtAdmin, requireJwtOrApiKey } from '@/lib/api-auth';
import { updateGoogleSheet } from '@/lib/db';
import { ok, err } from '@/lib/api';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, context: RouteContext) {
  const auth = await requireJwtOrApiKey(req);
  if (auth instanceof Response) return auth;

  if (auth.type === 'user') {
    const ptCheck = assertNotPtAdmin(auth.user, req.nextUrl.pathname);
    if (ptCheck) return ptCheck;
  }

  const { id } = await context.params;

  try {
    const body = await req.json();
    const sheet = await updateGoogleSheet(id, body);

    if (!sheet) {
      return err('Google sheet connection not found', 404);
    }

    return ok(sheet);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to update google sheet connection';
    return err(message, 500);
  }
}
