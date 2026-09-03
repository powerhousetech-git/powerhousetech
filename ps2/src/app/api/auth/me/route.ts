import { NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { ok, err } from '@/lib/api';

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return err('Not authenticated', 401);
  }
  return ok({ user: session });
}
