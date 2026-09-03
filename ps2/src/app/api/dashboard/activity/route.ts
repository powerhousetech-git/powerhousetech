import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/api-auth';
import { listActivity } from '@/lib/db';
import { ok, err } from '@/lib/api';

export async function GET(req: NextRequest) {
  const session = await requireAuthUser(req);
  if (session instanceof Response) return session;

  try {
    const activity = await listActivity(20);
    return ok(activity);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load activity';
    return err(message, 500);
  }
}
