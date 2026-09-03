import { NextRequest } from 'next/server';
import { isApiResponse, requireAuth } from '@/lib/auth';
import { listSettings, upsertSetting } from '@/lib/db';
import { ok, err } from '@/lib/api';

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (isApiResponse(authResult)) {
    return err(authResult.error ?? 'Unauthorized', 401);
  }

  const session = authResult.user;
  if (session.role !== 'pt_admin') {
    return err('Forbidden: pt_admin role required', 403);
  }

  const settings = await listSettings();
  return ok(settings);
}

export async function PATCH(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (isApiResponse(authResult)) {
    return err(authResult.error ?? 'Unauthorized', 401);
  }

  const session = authResult.user;
  if (session.role !== 'pt_admin') {
    return err('Forbidden: pt_admin role required', 403);
  }

  try {
    const body = await req.json();
    const { key, value } = body;

    if (!key) {
      return err('key is required');
    }

    const setting = await upsertSetting(key, value ?? {}, session.organization_id);
    return ok(setting);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to update setting';
    return err(message, 500);
  }
}
