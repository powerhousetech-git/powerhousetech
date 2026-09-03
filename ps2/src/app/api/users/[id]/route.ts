import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/api-auth';
import { deleteUser, updateUser } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { ok, err } from '@/lib/api';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, context: RouteContext) {
  const session = await requireAuthUser(req);
  if (session instanceof Response) return session;

  if (session.role !== 'sahasra_admin') {
    return err('Forbidden: sahasra_admin role required', 403);
  }

  const { id } = await context.params;

  try {
    const body = await req.json();
    const updates = { ...body };
    if (body.password) {
      updates.password_hash = await hashPassword(body.password);
      delete updates.password;
    }

    const user = await updateUser(id, updates);

    if (!user) {
      return err('User not found', 404);
    }

    const { password_hash: _, ...safeUser } = user;
    return ok(safeUser);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to update user';
    return err(message, 500);
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const session = await requireAuthUser(req);
  if (session instanceof Response) return session;

  if (session.role !== 'sahasra_admin') {
    return err('Forbidden: sahasra_admin role required', 403);
  }

  const { id } = await context.params;

  if (id === session.id) {
    return err('Cannot delete your own account');
  }

  try {
    const deleted = await deleteUser(id);

    if (!deleted) {
      return err('User not found', 404);
    }

    return ok({ deleted: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to delete user';
    return err(message, 500);
  }
}
