import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/api-auth';
import { createProject, getLead, logActivity, updateLead } from '@/lib/db';
import { ok, err } from '@/lib/api';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  const session = await requireAuthUser(req);
  if (session instanceof Response) return session;

  const { id } = await context.params;

  const lead = await getLead(id);
  if (!lead) {
    return err('Lead not found', 404);
  }

  if (lead.status === 'converted') {
    return err('Lead is already converted');
  }

  try {
    const body = await req.json().catch(() => ({}));

    const project = await createProject({
      organization_id: session.organization_id,
      lead_id: id,
      client_name: body.client_name ?? lead.company ?? lead.full_name ?? 'Unknown Client',
      project_name: body.project_name ?? `Project — ${lead.company ?? lead.full_name ?? id}`,
      order_value: body.order_value ?? 0,
      stage: 'enquiry_received',
      assigned_to: body.assigned_to ?? lead.assigned_to ?? session.id,
      target_date: body.target_date ?? null,
      notes: body.notes ?? lead.notes,
      quotation_ref: body.quotation_ref ?? null,
      documents: [],
      stage_entered_at: new Date().toISOString(),
    });

    const updatedLead = await updateLead(id, { status: 'converted' });

    await logActivity({
      organization_id: session.organization_id,
      actor_id: session.id,
      entity_type: 'lead',
      entity_id: id,
      action: 'converted',
      summary: `Lead converted to project: ${project.project_name}`,
      metadata: { project_id: project.id },
    });

    return ok({ lead: updatedLead, project }, 201);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to convert lead';
    return err(message, 500);
  }
}
