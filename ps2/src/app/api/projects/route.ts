import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/api-auth';
import { createProject, listProjects } from '@/lib/db';
import { ok, err } from '@/lib/api';

export async function GET(req: NextRequest) {
  const session = await requireAuthUser(req);
  if (session instanceof Response) return session;

  const { searchParams } = req.nextUrl;
  let projects = await listProjects();

  const stage = searchParams.get('stage');
  const assignedTo = searchParams.get('assigned_to');
  const search = searchParams.get('search');

  if (stage) {
    projects = projects.filter((p) => p.stage === stage);
  }
  if (assignedTo) {
    projects = projects.filter((p) => p.assigned_to === assignedTo);
  }
  if (search) {
    const q = search.toLowerCase();
    projects = projects.filter(
      (p) =>
        p.client_name.toLowerCase().includes(q) ||
        p.project_name.toLowerCase().includes(q)
    );
  }

  return ok(projects);
}

export async function POST(req: NextRequest) {
  const session = await requireAuthUser(req);
  if (session instanceof Response) return session;

  try {
    const body = await req.json();
    const project = await createProject({
      organization_id: session.organization_id,
      lead_id: body.lead_id ?? null,
      client_name: body.client_name,
      project_name: body.project_name,
      order_value: body.order_value ?? 0,
      stage: body.stage ?? 'enquiry_received',
      assigned_to: body.assigned_to ?? session.id,
      target_date: body.target_date ?? null,
      notes: body.notes ?? null,
      quotation_ref: body.quotation_ref ?? null,
      documents: body.documents ?? [],
      stage_entered_at: new Date().toISOString(),
    });
    return ok(project, 201);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to create project';
    return err(message, 500);
  }
}
