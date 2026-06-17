/** Deterministic balance-sheet line extraction for common Indian pl/bs workbook layouts. */

export type BalanceSheetHints = {
  confidence: 'high' | 'medium' | 'low' | 'none';
  current: {
    long_term_borrowings: number;
    short_term_borrowings: number;
    trade_payables: number;
    other_current_liabilities: number;
    long_term_loans_advances: number;
    short_term_loans_advances: number;
    other_current_assets: number;
    total_liabilities: number;
    total_assets: number;
  };
  booksImbalance: number;
  matchedLabels: string[];
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function parseNumber(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const s = String(raw ?? '').replace(/,/g, '').trim();
  if (!s || s === '-') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function splitLine(line: string): string[] {
  if (line.includes('\t')) return line.split('\t').map((c) => c.trim());
  return line.split(',').map((c) => c.trim());
}

function rowLabel(cells: string[]): string {
  return cells.filter(Boolean).join(' ').trim();
}

function rowAmounts(cells: string[]): number[] {
  return cells.map(parseNumber).filter((n): n is number => n != null && Math.abs(n) > 0.001);
}

function pickLiabilityAmount(cells: string[]): number {
  const nums = rowAmounts(cells);
  if (!nums.length) return 0;
  return Math.max(...nums.map((n) => Math.abs(n)));
}

const UNSECURED = /\bunsecured\s+loans?\b/i;
const SECURED = /\b(secured\s+loans?|cc\s+limit|cash\s+credit|overdraft)\b/i;
const AUDIT_PAYABLE = /\baudit\s+fees?\s+payable\b/i;
const TRADE_CREDITOR = /\b(sundry\s+creditors?|trade\s+payables?|goods\s+creditors?)\b/i;
const SECURITY_DEPOSIT = /\bsecurity\s+deposit/i;
const GST_ASSET = /\b(gst\s+input|gst\s+receivable|gst\b)/i;
const TDS_ASSET = /\btds\s+(deducted|receivable)/i;

export function extractBalanceSheetHints(sourceText: string): BalanceSheetHints | null {
  const lines = String(sourceText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (!lines.length) return null;

  const matchedLabels: string[] = [];
  let longTermBorrowings = 0;
  let shortTermBorrowings = 0;
  let tradePayables = 0;
  let otherCurrentLiabilities = 0;
  let longTermLoansAdvances = 0;
  let shortTermLoansAdvances = 0;
  let otherCurrentAssets = 0;
  let totalLiabilities = 0;
  let totalAssets = 0;
  let inBs = false;
  let inCreditors = false;

  for (const line of lines) {
    if (/balance\s+sheet|as\s+on|as\s+at/i.test(line)) inBs = true;
    const cells = splitLine(line);
    const label = rowLabel(cells);
    const ll = label.toLowerCase();

    if (TRADE_CREDITOR.test(ll) && !/asset/i.test(ll)) inCreditors = true;

    if (UNSECURED.test(ll)) {
      const amt = pickLiabilityAmount(cells);
      if (amt > 0) {
        longTermBorrowings = round2(longTermBorrowings + amt);
        matchedLabels.push(label);
        inBs = true;
      }
      continue;
    }

    if (SECURED.test(ll) && !UNSECURED.test(ll)) {
      const amt = pickLiabilityAmount(cells);
      if (amt > 0) {
        shortTermBorrowings = round2(shortTermBorrowings + amt);
        matchedLabels.push(label);
        inBs = true;
      }
      continue;
    }

    if (AUDIT_PAYABLE.test(ll)) {
      const amt = pickLiabilityAmount(cells);
      if (amt > 0) {
        otherCurrentLiabilities = round2(otherCurrentLiabilities + amt);
        matchedLabels.push(label);
        inBs = true;
      }
      continue;
    }

    if (inBs && inCreditors && !AUDIT_PAYABLE.test(ll)) {
      const name = cells[0]?.trim() || '';
      const nums = rowAmounts(cells.slice(1));
      const amt = nums.length ? Math.abs(nums[0]) : 0;
      if (
        amt > 50000
        && name
        && !/^(current|liabilit|provision|total|secured|unsecured|audit)/i.test(name)
      ) {
        tradePayables = round2(Math.max(tradePayables, amt));
        matchedLabels.push(`trade creditor: ${name}`);
      }
    }

    if (SECURITY_DEPOSIT.test(ll)) {
      const amt = pickLiabilityAmount(cells);
      if (amt > 0) {
        longTermLoansAdvances = round2(Math.max(longTermLoansAdvances, amt));
        matchedLabels.push(label);
      }
    }

    if (GST_ASSET.test(ll) && !/paid|payable/i.test(ll)) {
      const amt = pickLiabilityAmount(cells);
      if (amt > 0) otherCurrentAssets = round2(Math.max(otherCurrentAssets, amt));
    }

    if (TDS_ASSET.test(ll)) {
      const amt = pickLiabilityAmount(cells);
      if (amt > 0) shortTermLoansAdvances = round2(shortTermLoansAdvances + amt);
    }

    if (inBs && /^total/i.test(ll)) {
      const nums = rowAmounts(cells);
      if (nums.length >= 2) {
        totalLiabilities = round2(Math.max(totalLiabilities, Math.abs(nums[0])));
        totalAssets = round2(Math.max(totalAssets, Math.abs(nums[nums.length - 1])));
      } else if (nums.length === 1) {
        if (totalLiabilities === 0) totalLiabilities = round2(Math.abs(nums[0]));
        else totalAssets = round2(Math.abs(nums[0]));
      }
    }
  }

  const booksImbalance = totalAssets > 0 && totalLiabilities > 0
    ? round2(totalAssets - totalLiabilities)
    : 0;

  let confidence: BalanceSheetHints['confidence'] = 'none';
  const signals = [
    longTermBorrowings > 0,
    shortTermBorrowings > 0,
    tradePayables > 0,
    otherCurrentLiabilities > 0,
    totalAssets > 0,
  ].filter(Boolean).length;

  if (signals >= 3) confidence = 'high';
  else if (signals >= 2) confidence = 'medium';
  else if (signals >= 1) confidence = 'low';

  if (confidence === 'none') return null;

  return {
    confidence,
    current: {
      long_term_borrowings: longTermBorrowings,
      short_term_borrowings: shortTermBorrowings,
      trade_payables: tradePayables,
      other_current_liabilities: otherCurrentLiabilities,
      long_term_loans_advances: longTermLoansAdvances,
      short_term_loans_advances: shortTermLoansAdvances,
      other_current_assets: otherCurrentAssets,
      total_liabilities: totalLiabilities,
      total_assets: totalAssets,
    },
    booksImbalance,
    matchedLabels,
  };
}

export function formatBalanceSheetBlock(hints: BalanceSheetHints): string {
  const c = hints.current;
  return [
    'PARSED_BALANCE_SHEET (deterministic — prefer these mapped totals when present):',
    `long_term_borrowings: ${c.long_term_borrowings}`,
    `short_term_borrowings: ${c.short_term_borrowings}`,
    `trade_payables: ${c.trade_payables}`,
    `other_current_liabilities: ${c.other_current_liabilities}`,
    `long_term_loans_advances: ${c.long_term_loans_advances}`,
    `short_term_loans_advances: ${c.short_term_loans_advances}`,
    `other_current_assets: ${c.other_current_assets}`,
    `source_total_liabilities: ${c.total_liabilities}`,
    `source_total_assets: ${c.total_assets}`,
    `books_imbalance: ${hints.booksImbalance}`,
    `confidence: ${hints.confidence}`,
  ].join('\n');
}
