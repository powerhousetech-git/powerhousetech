import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/api-auth';
import { getProject, updateProject } from '@/lib/db';
import { ok, err } from '@/lib/api';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  const session = await requireAuthUser(req);
  if (session instanceof Response) return session;

  const { id } = await context.params;
  const project = await getProject(id);

  if (!project) {
    return err('Project not found', 404);
  }

  return ok(project);
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const session = await requireAuthUser(req);
  if (session instanceof Response) return session;

  const { id } = await context.params;

  try {
    const body = await req.json();
    const project = await updateProject(id, body);

    if (!project) {
      return err('Project not found', 404);
    }

    return ok(project);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to update project';
    return err(message, 500);
  }
}
