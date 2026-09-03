import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/api-auth';
import { createLead, listLeads } from '@/lib/db';
import type { LeadSource } from '@/lib/types';
import { ok, err } from '@/lib/api';

type ColumnMapping = Record<string, string>;

function mapRow(
  row: Record<string, unknown>,
  mapping: ColumnMapping
): Record<string, unknown> {
  const lead: Record<string, unknown> = {};

  for (const [excelCol, leadField] of Object.entries(mapping)) {
    if (leadField && row[excelCol] !== undefined && row[excelCol] !== '') {
      lead[leadField] = row[excelCol];
    }
  }

  if (!lead.full_name && (lead.first_name || lead.last_name)) {
    lead.full_name = [lead.first_name, lead.last_name].filter(Boolean).join(' ');
  }

  return lead;
}

export async function POST(req: NextRequest) {
  const session = await requireAuthUser(req);
  if (session instanceof Response) return session;

  try {
    const body = await req.json();
    const { rows, mapping } = body as {
      rows: Record<string, unknown>[];
      mapping: ColumnMapping;
    };

    if (!Array.isArray(rows) || rows.length === 0) {
      return err('rows array is required');
    }

    if (!mapping || typeof mapping !== 'object') {
      return err('mapping object is required');
    }

    const existing = await listLeads({ pageSize: 10000 });
    const existingEmails = new Set(
      existing.items
        .map((l) => l.email?.trim().toLowerCase())
        .filter(Boolean)
    );

    const imported: unknown[] = [];
    const skipped: { row: number; reason: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const mapped = mapRow(rows[i], mapping);
      const email = String(mapped.email ?? '').trim().toLowerCase();

      if (email && existingEmails.has(email)) {
        skipped.push({ row: i + 1, reason: 'duplicate_email' });
        continue;
      }

      try {
        const created = await createLead({
          organization_id: session.organization_id,
          first_name: String(mapped.first_name ?? ''),
          last_name: String(mapped.last_name ?? ''),
          full_name: String(mapped.full_name ?? ''),
          company: String(mapped.company ?? ''),
          designation: String(mapped.designation ?? ''),
          email: String(mapped.email ?? ''),
          phone: String(mapped.phone ?? ''),
          website: String(mapped.website ?? ''),
          website_summary: null,
          status: 'new',
          source: 'excel' as LeadSource,
          assigned_to: session.id,
          tags: Array.isArray(mapped.tags) ? (mapped.tags as string[]) : [],
          custom_intro: null,
          notes: mapped.notes ? String(mapped.notes) : null,
          meeting_scheduled_at: null,
          upload_batch_id: null,
          last_activity_at: new Date().toISOString(),
        });
        imported.push(created);
        if (email) existingEmails.add(email);
      } catch {
        skipped.push({ row: i + 1, reason: 'import_failed' });
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
