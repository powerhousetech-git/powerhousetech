import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/api-auth';
import { advanceProjectStage } from '@/lib/db';
import type { ProjectStage } from '@/lib/types';
import { ok, err } from '@/lib/api';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  const session = await requireAuthUser(req);
  if (session instanceof Response) return session;

  const { id } = await context.params;

  try {
    const body = await req.json();
    const { to_stage, notes } = body;

    if (!to_stage) {
      return err('to_stage is required');
    }

    const project = await advanceProjectStage(
      id,
      to_stage as ProjectStage,
      notes ?? null,
      session.id
    );

    if (!project) {
      return err('Project not found', 404);
    }

    return ok(project);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to advance project stage';
    return err(message, 500);
  }
}
