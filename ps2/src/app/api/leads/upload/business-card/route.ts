import { NextRequest } from 'next/server';
import { requireAuthUser } from '@/lib/api-auth';
import { extractBusinessCardContacts } from '@/lib/business-card';
import { ok, err } from '@/lib/api';

export async function POST(req: NextRequest) {
  const session = await requireAuthUser(req);
  if (session instanceof Response) return session;

  try {
    const contentType = req.headers.get('content-type') ?? '';

    if (contentType.includes('application/json')) {
      const body = await req.json();
      const contacts = await extractBusinessCardContacts({
        filename: body.filename ?? 'mock-card.pdf',
        mockContacts: body.contacts ?? body.leads,
      });
      return ok({ contacts, source: 'mock' });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return err('PDF file is required');
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const contacts = await extractBusinessCardContacts({
      pdfBuffer: buffer,
      filename: file.name,
    });

    return ok({
      contacts,
      source: process.env.ANTHROPIC_API_KEY ? 'claude' : 'mock',
      filename: file.name,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to process business card';
    return err(message, 500);
  }
}
