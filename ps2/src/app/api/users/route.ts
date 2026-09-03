import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/api-auth';
import { createUser, listUsers } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { ok, err } from '@/lib/api';

export async function GET(req: NextRequest) {
  const session = await requireAuthUser(req);
  if (session instanceof Response) return session;

  if (session.role !== 'sahasra_admin') {
    return err('Forbidden: sahasra_admin role required', 403);
  }

  const users = await listUsers();
  return ok(users);
}

export async function POST(req: NextRequest) {
  const session = await requireAuthUser(req);
  if (session instanceof Response) return session;

  if (session.role !== 'sahasra_admin') {
    return err('Forbidden: sahasra_admin role required', 403);
  }

  try {
    const body = await req.json();
    const passwordHash = body.password
      ? await hashPassword(body.password)
      : body.password_hash;

    const user = await createUser({
      organization_id: session.organization_id,
      username: body.username,
      password_hash: passwordHash,
      full_name: body.full_name ?? body.username,
      role: body.role ?? 'sahasra_employee',
      outlook_account: body.outlook_account ?? null,
      is_active: body.is_active ?? true,
    });

    const { password_hash: _, ...safeUser } = user;
    return ok(safeUser, 201);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to create user';
    return err(message, 500);
  }
}
