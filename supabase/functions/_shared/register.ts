/** Sales and purchase register parsers. */

export type RegisterLine = {
  id: string;
  date: string;
  docNo: string;
  party: string;
  taxable: number;
  tax: number;
  total: number;
  kind: 'sales' | 'purchase';
  sourceFile: string;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function parseNum(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const s = String(raw ?? '').replace(/,/g, '').trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function splitLine(line: string): string[] {
  if (line.includes('\t')) return line.split('\t').map((c) => c.trim());
  return line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
}

function parseDate(raw: string): string {
  const dmy = String(raw).trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (dmy) {
    const y = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    return `${y}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  return String(raw).trim();
}

let regCounter = 0;

export function parseRegisterText(
  sourceText: string,
  kind: 'sales' | 'purchase',
  sourceFile: string,
): RegisterLine[] {
  const lines = String(sourceText || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];

  const rows = lines.map(splitLine);
  const headerRow = rows.find((r) => /date|invoice|bill|party|supplier|total/i.test(r.join(' ')));
  const start = headerRow ? rows.indexOf(headerRow) + 1 : 1;
  const headers = (headerRow || []).map((h) => h.toLowerCase());

  const dateIdx = headers.findIndex((h) => /date/.test(h));
  const docIdx = headers.findIndex((h) => /invoice|bill|voucher|doc/.test(h));
  const partyIdx = headers.findIndex((h) => /party|customer|supplier|name/.test(h));
  const taxIdx = headers.findIndex((h) => /gst|tax/.test(h));
  const totalIdx = headers.findIndex((h) => /total/.test(h));
  const taxableIdx = headers.findIndex((h) => /taxable|value|amount/.test(h));

  const out: RegisterLine[] = [];
  for (let i = start; i < rows.length; i++) {
    const cells = rows[i];
    if (!cells.length) continue;

    const total = totalIdx >= 0 ? parseNum(cells[totalIdx]) : null;
    const taxable = taxableIdx >= 0 ? parseNum(cells[taxableIdx]) : null;
    const tax = taxIdx >= 0 ? parseNum(cells[taxIdx]) : null;
    const t = total ?? (taxable != null && tax != null ? taxable + tax : null);
    if (t == null || t <= 0) continue;

    regCounter += 1;
    out.push({
      id: `reg_${kind}_${regCounter}`,
      date: dateIdx >= 0 ? parseDate(cells[dateIdx]) : '',
      docNo: docIdx >= 0 ? cells[docIdx] : '',
      party: partyIdx >= 0 ? cells[partyIdx] : '',
      taxable: round2(taxable ?? t - (tax || 0)),
      tax: round2(tax || 0),
      total: round2(t),
      kind,
      sourceFile,
    });
  }
  return out;
}

export function formatRegisterBlock(lines: RegisterLine[], label: string): string {
  if (!lines.length) return '';
  return [
    `PARSED_${label}:`,
    ...lines.map((l) => `${l.date}\t${l.docNo}\t${l.party}\t${l.total}`),
    `line_count: ${lines.length}`,
    `total_value: ${round2(lines.reduce((s, l) => s + l.total, 0))}`,
  ].join('\n');
}
