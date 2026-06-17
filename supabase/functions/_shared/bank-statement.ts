/** Parse bank statement CSV/TSV and plain-text exports into normalized transactions. */

export type BankTransaction = {
  id: string;
  date: string;
  narration: string;
  ref: string;
  debit: number;
  credit: number;
  balance: number | null;
  sourceFile: string;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function parseNum(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const s = String(raw ?? '').replace(/,/g, '').trim();
  if (!s || s === '-' || s === '—') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function splitLine(line: string): string[] {
  if (line.includes('\t')) return line.split('\t').map((c) => c.trim());
  return line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
}

function parseDate(raw: string): string {
  const s = String(raw || '').trim();
  const dmy = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (dmy) {
    const y = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    const mm = dmy[2].padStart(2, '0');
    const dd = dmy[1].padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  return s;
}

function headerIndex(headers: string[], patterns: RegExp[]): number {
  return headers.findIndex((h) => patterns.some((p) => p.test(h)));
}

let txnCounter = 0;
function newId(): string {
  txnCounter += 1;
  return `bnk_${txnCounter}`;
}

export function resetBankTxnIds(): void {
  txnCounter = 0;
}

export function parseBankStatementText(
  sourceText: string,
  sourceFile = 'bank',
): BankTransaction[] {
  const lines = String(sourceText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const rows: string[][] = lines.map(splitLine);
  const headerRow = rows.find((r) =>
    /date|narration|particular|withdrawal|deposit|debit|credit/i.test(r.join(' ')),
  );
  const dataStart = headerRow ? rows.indexOf(headerRow) + 1 : 0;
  const headers = (headerRow || rows[0] || []).map((h) => h.toLowerCase());

  const dateIdx = headerIndex(headers, [/date/, /txn.?date/, /value.?date/]);
  const narrIdx = headerIndex(headers, [/narration/, /particular/, /description/, /remarks/]);
  const refIdx = headerIndex(headers, [/ref/, /chq/, /cheque/, /utr/]);
  const drIdx = headerIndex(headers, [/withdrawal/, /^dr/, /debit/]);
  const crIdx = headerIndex(headers, [/deposit/, /^cr/, /credit/]);
  const balIdx = headerIndex(headers, [/balance/, /closing/]);

  const out: BankTransaction[] = [];

  for (let i = dataStart; i < rows.length; i++) {
    const cells = rows[i];
    if (!cells.length || cells.every((c) => !c)) continue;

    const joined = cells.join(' ').toLowerCase();
    if (/^opening\s+balance|^total|^closing\s+balance/i.test(joined)) continue;

    let date = dateIdx >= 0 ? parseDate(cells[dateIdx]) : '';
    let narration = narrIdx >= 0 ? cells[narrIdx] : cells[1] || cells[0] || '';
    let ref = refIdx >= 0 ? cells[refIdx] : '';

    let debit = drIdx >= 0 ? parseNum(cells[drIdx]) : null;
    let credit = crIdx >= 0 ? parseNum(cells[crIdx]) : null;
    const balance = balIdx >= 0 ? parseNum(cells[balIdx]) : null;

    if (dateIdx < 0 && cells[0]) date = parseDate(cells[0]);
    if (narrIdx < 0 && cells[1]) narration = cells[1];

    if (debit == null && credit == null) {
      const nums = cells.map(parseNum).filter((n): n is number => n != null && Math.abs(n) > 0.001);
      if (nums.length >= 2) {
        const last = nums[nums.length - 1];
        const movement = nums[nums.length - 2];
        if (balance != null && Math.abs(last - balance) < 0.01) {
          if (movement > 0) credit = movement;
          else debit = Math.abs(movement);
        } else if (movement > 0) {
          credit = movement;
        } else {
          debit = Math.abs(movement);
        }
      } else if (nums.length === 1) {
        if (nums[0] > 0) credit = nums[0];
        else debit = Math.abs(nums[0]);
      }
    }

    debit = round2(debit || 0);
    credit = round2(credit || 0);
    if (debit === 0 && credit === 0) continue;

    out.push({
      id: newId(),
      date,
      narration: String(narration || '').trim(),
      ref: String(ref || '').trim(),
      debit,
      credit,
      balance: balance != null ? round2(balance) : null,
      sourceFile,
    });
  }

  return out;
}

export function formatBankBlock(txns: BankTransaction[]): string {
  if (!txns.length) return '';
  const lines = txns.slice(0, 500).map(
    (t) =>
      `${t.date}\t${t.narration}\t${t.debit || ''}\t${t.credit || ''}\t${t.balance ?? ''}`,
  );
  return [
    'PARSED_BANK_STATEMENT (deterministic extract — use for classification context):',
    'date\tnarration\tdebit\tcredit\tbalance',
    ...lines,
    `transaction_count: ${txns.length}`,
  ].join('\n');
}
