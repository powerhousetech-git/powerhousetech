import { NextRequest } from 'next/server';
import {
  assertNotPtAdmin,
  getActorId,
  requireJwtOrApiKey,
} from '@/lib/api-auth';
import { createGoogleSheet, listGoogleSheets } from '@/lib/db';
import { ok, err } from '@/lib/api';

export async function GET(req: NextRequest) {
  const auth = await requireJwtOrApiKey(req);
  if (auth instanceof Response) return auth;

  const sheets = await listGoogleSheets();
  return ok(sheets);
}

export async function POST(req: NextRequest) {
  const auth = await requireJwtOrApiKey(req);
  if (auth instanceof Response) return auth;

  if (auth.type === 'user') {
    const ptCheck = assertNotPtAdmin(auth.user, req.nextUrl.pathname);
    if (ptCheck) return ptCheck;
  }

  try {
    const body = await req.json();
    const actorId = getActorId(auth);
    const orgId =
      auth.type === 'service' ? auth.organization_id : auth.user.organization_id;

    const sheet = await createGoogleSheet({
      organization_id: orgId,
      sheet_url: body.sheet_url,
      sheet_id: body.sheet_id ?? '',
      tab_name: body.tab_name ?? 'Sheet1',
      column_mapping: body.column_mapping ?? {},
      sync_interval_hours: body.sync_interval_hours ?? 24,
      last_synced_at: body.last_synced_at ?? null,
      is_active: body.is_active ?? true,
      created_by: actorId,
    });

    return ok(sheet, 201);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to create google sheet connection';
    return err(message, 500);
  }
}
