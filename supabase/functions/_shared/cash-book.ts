/** Parse petty cash / cash book spreadsheets. */

export type CashTransaction = {
  id: string;
  date: string;
  narration: string;
  receipt: number;
  payment: number;
  balance: number | null;
  sourceFile: string;
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

function parseDate(raw: string): string {
  const dmy = String(raw).trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (dmy) {
    const y = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    return `${y}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  return String(raw).trim();
}

let cashCounter = 0;

export function parseCashBookText(sourceText: string, sourceFile = 'cash'): CashTransaction[] {
  const lines = String(sourceText || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];

  const rows = lines.map(splitLine);
  const headerRow = rows.find((r) => /date|particular|receipt|payment/i.test(r.join(' ')));
  const start = headerRow ? rows.indexOf(headerRow) + 1 : 1;
  const headers = (headerRow || []).map((h) => h.toLowerCase());

  const dateIdx = headers.findIndex((h) => /date/.test(h));
  const narrIdx = headers.findIndex((h) => /particular|narration/.test(h));
  const rcptIdx = headers.findIndex((h) => /receipt|income|credit/.test(h));
  const payIdx = headers.findIndex((h) => /payment|expense|debit/.test(h));
  const balIdx = headers.findIndex((h) => /balance/.test(h));

  const out: CashTransaction[] = [];
  for (let i = start; i < rows.length; i++) {
    const cells = rows[i];
    if (!cells.length) continue;
    if (/opening|total/i.test(cells.join(' '))) continue;

    const receipt = round2(rcptIdx >= 0 ? parseNum(cells[rcptIdx]) || 0 : 0);
    const payment = round2(payIdx >= 0 ? parseNum(cells[payIdx]) || 0 : 0);
    if (receipt === 0 && payment === 0) continue;

    cashCounter += 1;
    out.push({
      id: `cash_${cashCounter}`,
      date: dateIdx >= 0 ? parseDate(cells[dateIdx]) : parseDate(cells[0] || ''),
      narration: narrIdx >= 0 ? cells[narrIdx] : cells[1] || '',
      receipt,
      payment,
      balance: balIdx >= 0 ? parseNum(cells[balIdx]) : null,
      sourceFile,
    });
  }
  return out;
}

export function formatCashBlock(txns: CashTransaction[]): string {
  if (!txns.length) return '';
  return [
    'PARSED_CASH_BOOK:',
    ...txns.map((t) => `${t.date}\t${t.narration}\t${t.receipt}\t${t.payment}`),
    `transaction_count: ${txns.length}`,
  ].join('\n');
}
