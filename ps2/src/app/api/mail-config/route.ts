import { NextRequest } from 'next/server';
import { requireJwtOrApiKey } from '@/lib/api-auth';
import { listMailConfig, updateMailConfigStep } from '@/lib/db';
import { isApiResponse, requireAuth } from '@/lib/auth';
import { ok, err } from '@/lib/api';

export async function GET(req: NextRequest) {
  const auth = await requireJwtOrApiKey(req);
  if (auth instanceof Response) return auth;

  const config = await listMailConfig();
  return ok(config);
}

export async function PATCH(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (isApiResponse(authResult)) {
    return err(authResult.error ?? 'Unauthorized', 401);
  }

  const session = authResult.user;
  if (session.role !== 'sahasra_admin') {
    return err('Forbidden: sahasra_admin role required', 403);
  }

  try {
    const body = await req.json();
    const { step_number, ...updates } = body;

    if (step_number === undefined) {
      return err('step_number is required');
    }

    const config = await updateMailConfigStep(step_number, updates);

    if (!config) {
      return err('Mail config step not found', 404);
    }

    return ok(config);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to update mail config';
    return err(message, 500);
  }
}
