import { NextRequest } from 'next/server';
import { isApiResponse, requireAuth, SessionUser } from '@/lib/auth';
import { getServiceContext } from '@/lib/db';
import { UserRole } from '@/lib/types';
import { err } from '@/lib/api';

export type AuthResult =
  | { type: 'user'; user: SessionUser }
  | { type: 'service'; organization_id: string; actor_id: string; actor_name: string };

const PT_ADMIN_ALLOWED_PATHS = [
  '/api/auth/me',
  '/api/auth/logout',
  '/api/settings/system',
];

export function assertNotPtAdmin(
  session: SessionUser,
  pathname: string
): Response | null {
  if (session.role !== 'pt_admin') return null;
  const allowed = PT_ADMIN_ALLOWED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
  if (allowed) return null;
  return err('Forbidden: pt_admin access restricted to system settings', 403);
}

export async function requireAuthUser(
  req: NextRequest,
  opts?: { skipPtAdminCheck?: boolean }
): Promise<SessionUser | Response> {
  const authResult = await requireAuth(req);
  if (isApiResponse(authResult)) {
    return err(authResult.error ?? 'Unauthorized', 401);
  }

  if (!opts?.skipPtAdminCheck) {
    const ptCheck = assertNotPtAdmin(authResult.user, req.nextUrl.pathname);
    if (ptCheck) return ptCheck;
  }

  return authResult.user;
}

export async function requireJwtOrApiKey(
  req: NextRequest,
  opts?: { roles?: UserRole[] }
): Promise<AuthResult | Response> {
  const apiKey = req.headers.get('x-api-key');
  if (apiKey && process.env.N8N_API_KEY && apiKey === process.env.N8N_API_KEY) {
    const ctx = getServiceContext();
    return {
      type: 'service',
      organization_id: ctx.organization_id,
      actor_id: ctx.actor_id,
      actor_name: ctx.actor_name,
    };
  }

  const authResult = await requireAuth(req);
  if (isApiResponse(authResult)) {
    return err(authResult.error ?? 'Unauthorized', 401);
  }

  const ptCheck = assertNotPtAdmin(authResult.user, req.nextUrl.pathname);
  if (ptCheck) return ptCheck;

  if (opts?.roles && !opts.roles.includes(authResult.user.role)) {
    return err('Forbidden', 403);
  }

  return { type: 'user', user: authResult.user };
}

export function getOrgId(auth: AuthResult): string {
  return auth.type === 'service' ? auth.organization_id : auth.user.organization_id;
}

export function getActorId(auth: AuthResult): string {
  return auth.type === 'service' ? auth.actor_id : auth.user.id;
}
