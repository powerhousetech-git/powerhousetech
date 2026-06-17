/** Opening / prior-year trial balance parser. */

export type OpeningLedger = {
  ledger: string;
  debit: number;
  credit: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function parseNum(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const s = String(raw ?? '').replace(/,/g, '').trim();
  if (!s || s === '-') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function splitLine(line: string): string[] {
  if (line.includes('\t')) return line.split('\t').map((c) => c.trim());
  return line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
}

export function parseOpeningTbText(sourceText: string): OpeningLedger[] {
  const lines = String(sourceText || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];

  const rows = lines.map(splitLine);
  const headerRow = rows.find((r) => /ledger|particular|debit|credit/i.test(r.join(' ')));
  const start = headerRow ? rows.indexOf(headerRow) + 1 : 0;
  const headers = (headerRow || rows[0] || []).map((h) => h.toLowerCase());

  const nameIdx = headers.findIndex((h) => /ledger|particular|account|name/.test(h));
  const drIdx = headers.findIndex((h) => /debit|^dr/.test(h));
  const crIdx = headers.findIndex((h) => /credit|^cr/.test(h));

  const out: OpeningLedger[] = [];
  for (let i = start; i < rows.length; i++) {
    const cells = rows[i];
    if (!cells.length) continue;
    const name = nameIdx >= 0 ? cells[nameIdx] : cells[0];
    if (!name || /total/i.test(name)) continue;

    const debit = round2(drIdx >= 0 ? parseNum(cells[drIdx]) || 0 : parseNum(cells[1]) || 0);
    const credit = round2(crIdx >= 0 ? parseNum(cells[crIdx]) || 0 : parseNum(cells[2]) || 0);
    if (debit === 0 && credit === 0) continue;

    out.push({ ledger: String(name).trim(), debit, credit });
  }
  return out;
}

export function formatOpeningTbBlock(ledgers: OpeningLedger[]): string {
  if (!ledgers.length) return '';
  return [
    'PARSED_OPENING_TRIAL_BALANCE:',
    ...ledgers.map((l) => `${l.ledger}\t${l.debit}\t${l.credit}`),
    `ledger_count: ${ledgers.length}`,
  ].join('\n');
}

/** Merge opening TB ledger names into COA when client uses custom names. */
export function extraLedgersFromOpening(opening: OpeningLedger[]): string[] {
  return opening.map((l) => l.ledger).filter(Boolean);
}
