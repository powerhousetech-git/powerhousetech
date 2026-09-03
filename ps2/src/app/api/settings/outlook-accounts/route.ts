import { NextRequest } from 'next/server';
import { requireJwtOrApiKey } from '@/lib/api-auth';
import { listOutlookAccounts } from '@/lib/db';
import { ok, err } from '@/lib/api';

export async function GET(req: NextRequest) {
  const auth = await requireJwtOrApiKey(req);
  if (auth instanceof Response) return auth;

  try {
    const accounts = await listOutlookAccounts();
    return ok(accounts);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load outlook accounts';
    return err(message, 500);
  }
}
