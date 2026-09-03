import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/api-auth';
import { getDashboardStats } from '@/lib/db';
import { ok, err } from '@/lib/api';

export async function GET(req: NextRequest) {
  const session = await requireAuthUser(req);
  if (session instanceof Response) return session;

  try {
    const stats = await getDashboardStats();
    return ok(stats);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load dashboard stats';
    return err(message, 500);
  }
}
