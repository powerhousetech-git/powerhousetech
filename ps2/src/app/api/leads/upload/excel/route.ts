import { NextRequest } from 'next/server';
import * as XLSX from 'xlsx';
import { requireAuthUser } from '@/lib/api-auth';
import { ok, err } from '@/lib/api';

function parseExcelBuffer(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  const columns =
    rows.length > 0 ? Object.keys(rows[0]) : XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })[0] ?? [];

  return {
    columns: Array.isArray(columns) ? columns.map(String) : [],
    rows,
    preview: rows.slice(0, 10),
    total_rows: rows.length,
    sheet_name: sheetName,
  };
}

export async function POST(req: NextRequest) {
  const session = await requireAuthUser(req);
  if (session instanceof Response) return session;

  try {
    const contentType = req.headers.get('content-type') ?? '';

    if (contentType.includes('application/json')) {
      const body = await req.json();
      const rows = body.rows as Record<string, unknown>[] | undefined;

      if (!Array.isArray(rows)) {
        return err('rows array is required for JSON upload');
      }

      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
      return ok({
        columns,
        rows,
        preview: rows.slice(0, 10),
        total_rows: rows.length,
        source: 'json',
      });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return err('Excel file is required');
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = parseExcelBuffer(buffer);

    return ok({
      ...parsed,
      filename: file.name,
      source: 'file',
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to parse Excel file';
    return err(message, 500);
  }
}
