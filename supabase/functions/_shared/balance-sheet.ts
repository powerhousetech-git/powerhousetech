/** Deterministic balance-sheet line extraction for common Indian pl/bs workbook layouts. */

export type BalanceSheetHints = {
  confidence: 'high' | 'medium' | 'low' | 'none';
  current: {
    owners_capital: number;
    long_term_borrowings: number;
    short_term_borrowings: number;
    trade_payables: number;
    other_current_liabilities: number;
    property_plant_equipment: number;
    long_term_loans_advances: number;
    inventories: number;
    trade_receivables: number;
    cash_and_bank: number;
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

function sheetBodies(sourceText: string, namePattern: RegExp): string[] {
  const sections = String(sourceText || '').split(/---\s*(?:Sheet|File):\s*([^\n-]+)\s*---/i);
  if (sections.length === 1) return [sections[0]];
  const out: string[] = [];
  for (let i = 1; i < sections.length; i += 2) {
    const name = (sections[i] || '').trim();
    if (namePattern.test(name)) out.push(sections[i + 1] || '');
  }
  return out;
}

function rowLabel(cells: string[]): string {
  return cells.filter(Boolean).join(' ').trim();
}

function rowAmounts(cells: string[]): number[] {
  return cells.map(parseNumber).filter((n): n is number => n != null && Math.abs(n) > 0.001);
}

function firstAmount(cells: string[], from = 0): number {
  for (let i = from; i < cells.length; i++) {
    const n = parseNumber(cells[i]);
    if (n != null && Math.abs(n) > 0.001) return round2(Math.abs(n));
  }
  return 0;
}

function findSplit(cells: string[]): number {
  const idx = cells.findIndex((c, i) => i >= 2 && /\b(fixed\s+assets|current\s+assets|assets)\b/i.test(String(c || '')));
  return idx >= 0 ? idx : 3;
}

const CAPITAL = /\b(capital\s+account|owners?'?\s+capital|proprietor)\b/i;
const UNSECURED = /\bunsecured\s+loans?\b/i;
const SECURED = /\b(secured\s+loans?|cc\s+limit|cash\s+credit|overdraft)\b/i;
const AUDIT_PAYABLE = /\baudit\s+fees?\s+payable\b/i;
const TRADE_CREDITOR = /\b(sundry\s+creditors?|trade\s+payables?|goods\s+creditors?)\b/i;
const FIXED_ASSETS = /\b(fixed\s+assets|schedule\s*[\"']?a)/i;
const SECURITY_DEPOSIT = /\bsecurity\s+deposit/i;
const GST_ASSET = /\bgst\b/i;
const TDS_ASSET = /\btds\s+(deducted|receivable)/i;
const CLOSING_STOCK = /\bclosing\s+stock\b/i;
const DEBTORS = /\b(sundry\s+debtors?|trade\s+receivables?)\b/i;
const CASH = /\bcash\s+in\s+hand\b/i;
const BANK = /\bbank\s+balances?\b/i;
const LOAN_ADVANCE = /\bloan\s+and\s+advance\b/i;

export function extractBalanceSheetHints(sourceText: string): BalanceSheetHints | null {
  const bodies = sheetBodies(sourceText, /\bbs\b|balance\s+sheet/i);
  if (!bodies.length) return null;
  const lines = bodies
    .flatMap((body) => body.split(/\r?\n/))
    .map((l) => l.replace(/\r/g, ''))
    .filter((l) => l.trim());

  if (!lines.length) return null;

  const matchedLabels: string[] = [];
  let ownersCapital = 0;
  let longTermBorrowings = 0;
  let shortTermBorrowings = 0;
  let tradePayables = 0;
  let otherCurrentLiabilities = 0;
  let propertyPlantEquipment = 0;
  let longTermLoansAdvances = 0;
  let inventories = 0;
  let tradeReceivables = 0;
  let cashAndBank = 0;
  let shortTermLoansAdvances = 0;
  let otherCurrentAssets = 0;
  let totalLiabilities = 0;
  let totalAssets = 0;
  let inBs = false;
  let inCreditors = false;

  for (const line of lines) {
    if (/balance\s+sheet|as\s+on|as\s+at/i.test(line)) inBs = true;
    const cells = splitLine(line);
    const split = findSplit(cells);
    const left = cells.slice(0, split);
    const right = cells.slice(split);
    const leftLabel = rowLabel(left);
    const rightLabel = rowLabel(right);
    const ll = leftLabel.toLowerCase();
    const rl = rightLabel.toLowerCase();

    if (TRADE_CREDITOR.test(ll) && !/asset/i.test(ll)) inCreditors = true;

    if (CAPITAL.test(ll)) {
      const amt = firstAmount(left, 1);
      if (amt > 0) {
        ownersCapital = amt;
        matchedLabels.push(leftLabel);
        inBs = true;
      }
    }

    if (UNSECURED.test(ll)) {
      const amt = firstAmount(left, 1);
      if (amt > 0) {
        longTermBorrowings = round2(longTermBorrowings + amt);
        matchedLabels.push(leftLabel);
        inBs = true;
      }
    }

    if (SECURED.test(ll) && !UNSECURED.test(ll)) {
      const amt = firstAmount(left, 1);
      if (amt > 0) {
        shortTermBorrowings = round2(shortTermBorrowings + amt);
        matchedLabels.push(leftLabel);
        inBs = true;
      }
    }

    if (AUDIT_PAYABLE.test(ll)) {
      const amt = firstAmount(left, 1);
      if (amt > 0) {
        otherCurrentLiabilities = round2(otherCurrentLiabilities + amt);
        matchedLabels.push(leftLabel);
        inBs = true;
      }
    }

    if (inBs && inCreditors && left[0]?.trim()) {
      const name = left[0].trim();
      const amt = firstAmount(left, 1);
      if (
        amt > 50000
        && name
        && !/^(current|liabilit|provision|total|secured|unsecured|audit|sundry\s+creditor)/i.test(name)
      ) {
        tradePayables = round2(Math.max(tradePayables, amt));
        matchedLabels.push(`trade creditor: ${name}`);
      }
    }

    if (FIXED_ASSETS.test(rl)) {
      const amt = firstAmount(right, 1);
      if (amt > 0) {
        propertyPlantEquipment = round2(Math.max(propertyPlantEquipment, amt));
        matchedLabels.push(rightLabel);
      }
    }

    if (LOAN_ADVANCE.test(rl)) {
      matchedLabels.push(rightLabel);
    }

    if (SECURITY_DEPOSIT.test(rl)) {
      const amt = firstAmount(right, 1);
      if (amt > 0) {
        longTermLoansAdvances = round2(Math.max(longTermLoansAdvances, amt));
        matchedLabels.push(rightLabel);
      }
    }

    if (GST_ASSET.test(rl) && !/paid|payable/i.test(rl)) {
      const amt = firstAmount(right, 1);
      if (amt > 0) {
        shortTermLoansAdvances = round2(Math.max(shortTermLoansAdvances, amt));
        matchedLabels.push(rightLabel);
      }
    }

    if (TDS_ASSET.test(rl)) {
      const amt = firstAmount(right, 1);
      if (amt > 0) shortTermLoansAdvances = round2(shortTermLoansAdvances + amt);
    }

    if (CLOSING_STOCK.test(rl)) {
      const amt = firstAmount(right, 1);
      if (amt > 0) inventories = round2(Math.max(inventories, amt));
    }

    if (DEBTORS.test(rl)) {
      const amt = firstAmount(right, 1);
      if (amt > 0) tradeReceivables = round2(Math.max(tradeReceivables, amt));
    }

    if (CASH.test(rl)) {
      const amt = firstAmount(right, 1);
      if (amt > 0) cashAndBank = round2(cashAndBank + amt);
    }

    if (BANK.test(rl)) {
      const amt = firstAmount(right, 1);
      if (amt > 0) cashAndBank = round2(cashAndBank + amt);
    }

    const footerNums = rowAmounts(cells);
    if (inBs && footerNums.length >= 2 && footerNums[0] > 100000 && footerNums[1] > 100000) {
      totalLiabilities = round2(Math.max(totalLiabilities, Math.abs(footerNums[0])));
      totalAssets = round2(Math.max(totalAssets, Math.abs(footerNums[1])));
    }
  }

  const booksImbalance = totalAssets > 0 && totalLiabilities > 0
    ? round2(totalAssets - totalLiabilities)
    : 0;

  let confidence: BalanceSheetHints['confidence'] = 'none';
  const signals = [
    ownersCapital > 0,
    longTermBorrowings > 0,
    tradePayables > 0,
    propertyPlantEquipment > 0,
    inventories > 0,
    tradeReceivables > 0,
  ].filter(Boolean).length;

  if (signals >= 4) confidence = 'high';
  else if (signals >= 2) confidence = 'medium';
  else if (signals >= 1) confidence = 'low';

  if (confidence === 'none') return null;

  return {
    confidence,
    current: {
      owners_capital: ownersCapital,
      long_term_borrowings: longTermBorrowings,
      short_term_borrowings: shortTermBorrowings,
      trade_payables: tradePayables,
      other_current_liabilities: otherCurrentLiabilities,
      property_plant_equipment: propertyPlantEquipment,
      long_term_loans_advances: longTermLoansAdvances,
      inventories,
      trade_receivables: tradeReceivables,
      cash_and_bank: cashAndBank,
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
    `owners_capital: ${c.owners_capital}`,
    `long_term_borrowings: ${c.long_term_borrowings}`,
    `short_term_borrowings: ${c.short_term_borrowings}`,
    `trade_payables: ${c.trade_payables}`,
    `other_current_liabilities: ${c.other_current_liabilities}`,
    `property_plant_equipment: ${c.property_plant_equipment}`,
    `long_term_loans_advances: ${c.long_term_loans_advances}`,
    `inventories: ${c.inventories}`,
    `trade_receivables: ${c.trade_receivables}`,
    `cash_and_bank: ${c.cash_and_bank}`,
    `short_term_loans_advances: ${c.short_term_loans_advances}`,
    `source_total_liabilities: ${c.total_liabilities}`,
    `source_total_assets: ${c.total_assets}`,
    `books_imbalance: ${c.booksImbalance}`,
    `confidence: ${hints.confidence}`,
  ].join('\n');
}
