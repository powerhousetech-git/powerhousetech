import { NextRequest } from 'next/server';
import { requireAuthUser, requireJwtOrApiKey } from '@/lib/api-auth';
import { createLead, listLeads } from '@/lib/db';
import type { LeadFilters } from '@/lib/types';
import { ok, err } from '@/lib/api';

export async function GET(req: NextRequest) {
  const auth = await requireJwtOrApiKey(req);
  if (auth instanceof Response) return auth;

  const { searchParams } = req.nextUrl;
  const filters: LeadFilters = {
    status: (searchParams.get('status') as LeadFilters['status']) ?? undefined,
    assigned_to: searchParams.get('assigned_to') ?? undefined,
    search: searchParams.get('search') ?? undefined,
    source: (searchParams.get('source') as LeadFilters['source']) ?? undefined,
    page: searchParams.get('page') ? Number(searchParams.get('page')) : undefined,
    pageSize: searchParams.get('limit')
      ? Number(searchParams.get('limit'))
      : searchParams.get('pageSize')
        ? Number(searchParams.get('pageSize'))
        : undefined,
  };

  const tag = searchParams.get('tag');
  if (tag) filters.tags = [tag];

  const result = await listLeads(filters);
  return ok(result);
}

export async function POST(req: NextRequest) {
  const session = await requireAuthUser(req);
  if (session instanceof Response) return session;

  try {
    const body = await req.json();
    const lead = await createLead({
      organization_id: session.organization_id,
      first_name: body.first_name ?? '',
      last_name: body.last_name ?? '',
      full_name: body.full_name ?? '',
      company: body.company ?? '',
      designation: body.designation ?? '',
      email: body.email ?? '',
      phone: body.phone ?? '',
      website: body.website ?? '',
      website_summary: body.website_summary ?? null,
      status: body.status ?? 'new',
      source: body.source ?? 'manual',
      assigned_to: body.assigned_to ?? session.id,
      tags: body.tags ?? [],
      custom_intro: body.custom_intro ?? null,
      notes: body.notes ?? null,
      meeting_scheduled_at: body.meeting_scheduled_at ?? null,
      upload_batch_id: body.upload_batch_id ?? null,
      last_activity_at: new Date().toISOString(),
    });
    return ok(lead, 201);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to create lead';
    return err(message, 500);
  }
}
