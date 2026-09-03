import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/api-auth';
import { createLead, listLeads } from '@/lib/db';
import type { LeadSource } from '@/lib/types';
import { ok, err } from '@/lib/api';

interface LeadInput {
  first_name?: string;
  last_name?: string;
  full_name?: string;
  company?: string;
  designation?: string;
  email?: string;
  phone?: string;
  website?: string;
  tags?: string[];
  notes?: string;
}

function toLeadPayload(
  lead: LeadInput,
  orgId: string,
  assignedTo: string
) {
  const first = lead.first_name ?? '';
  const last = lead.last_name ?? '';
  return {
    organization_id: orgId,
    first_name: first,
    last_name: last,
    full_name: lead.full_name ?? [first, last].filter(Boolean).join(' '),
    company: lead.company ?? '',
    designation: lead.designation ?? '',
    email: lead.email ?? '',
    phone: lead.phone ?? '',
    website: lead.website ?? '',
    website_summary: null,
    status: 'new' as const,
    source: 'business_card' as LeadSource,
    assigned_to: assignedTo,
    tags: lead.tags ?? [],
    custom_intro: null,
    notes: lead.notes ?? null,
    meeting_scheduled_at: null,
    upload_batch_id: null,
    last_activity_at: new Date().toISOString(),
  };
}

export async function POST(req: NextRequest) {
  const session = await requireAuthUser(req);
  if (session instanceof Response) return session;

  try {
    const body = await req.json();
    const leads: LeadInput[] = body.leads;

    if (!Array.isArray(leads) || leads.length === 0) {
      return err('leads array is required');
    }

    const existing = await listLeads({ pageSize: 10000 });
    const existingEmails = new Set(
      existing.items
        .map((l) => l.email?.trim().toLowerCase())
        .filter(Boolean)
    );

    const imported: unknown[] = [];
    const skipped: { email: string; reason: string }[] = [];
    const seenEmails = new Set<string>();

    for (const lead of leads) {
      const email = lead.email?.trim().toLowerCase();
      if (email) {
        if (seenEmails.has(email) || existingEmails.has(email)) {
          skipped.push({ email, reason: 'duplicate_email' });
          continue;
        }
        seenEmails.add(email);
      }

      try {
        const created = await createLead(
          toLeadPayload(lead, session.organization_id, session.id)
        );
        imported.push(created);
        if (email) existingEmails.add(email);
      } catch {
        skipped.push({ email: email ?? 'unknown', reason: 'import_failed' });
      }
    }

    return ok({
      imported_count: imported.length,
      skipped_count: skipped.length,
      imported,
      skipped,
    }, 201);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Import failed';
    return err(message, 500);
  }
}
