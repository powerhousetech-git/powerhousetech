import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/api-auth';
import { bulkUpdateLeads, deleteLead } from '@/lib/db';
import type { Lead } from '@/lib/types';
import { ok, err } from '@/lib/api';

export async function POST(req: NextRequest) {
  const session = await requireAuthUser(req);
  if (session instanceof Response) return session;

  try {
    const body = await req.json();
    const { ids, action, payload } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return err('ids array is required');
    }

    if (!action || !['assign', 'tag', 'delete'].includes(action)) {
      return err('action must be assign, tag, or delete');
    }

    if (action === 'delete') {
      let deleted = 0;
      for (const id of ids) {
        if (await deleteLead(id)) deleted++;
      }
      return ok({ action, affected: deleted });
    }

    const updates: Partial<Lead> = {};
    if (action === 'assign') {
      if (!payload?.assigned_to) return err('payload.assigned_to is required for assign');
      updates.assigned_to = payload.assigned_to;
    } else if (action === 'tag') {
      if (!payload?.tags) return err('payload.tags is required for tag');
      updates.tags = payload.tags;
    }

    const affected = await bulkUpdateLeads(ids, updates);
    return ok({ action, affected });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Bulk operation failed';
    return err(message, 500);
  }
}
