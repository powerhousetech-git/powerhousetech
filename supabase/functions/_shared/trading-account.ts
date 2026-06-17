/** Deterministic trading-account extraction for common Indian pl / T&B layouts. */

export type TradingPeriodComponents = {
  openingStock: number;
  purchases: number;
  rateDifference: number;
  closingStock: number;
  cogs: number;
};

export type TradingAccountHints = {
  confidence: 'high' | 'medium' | 'low' | 'none';
  current: TradingPeriodComponents;
  /** Signed net result from source when found (negative = loss). */
  netProfitCurrent?: number;
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
  const parts = cells.slice(0, 3).filter(Boolean);
  return parts.join(' ').trim();
}

function rowNumbers(cells: string[]): number[] {
  const nums: number[] = [];
  for (const cell of cells) {
    const n = parseNumber(cell);
    if (n !== null && Math.abs(n) > 0.001) nums.push(n);
  }
  return nums;
}

function pickDebitAmount(cells: string[]): number {
  const nums = rowNumbers(cells);
  if (!nums.length) return 0;
  return Math.abs(nums[0]);
}

function pickCreditAmount(cells: string[]): number {
  const nums = rowNumbers(cells);
  if (!nums.length) return 0;
  // Closing stock often appears after a label column; use the largest plausible stock figure.
  const abs = nums.map((n) => Math.abs(n));
  return Math.max(...abs);
}

const OPENING = /\b(opening\s*stock|op\.?\s*stock|opening\s*inventory)\b/i;
const PURCHASE = /\b(purchases?|purchase\s+account)\b/i;
const RATE_DIFF = /\b(rate\s*diff(?:erence)?|rd\s+on\s+purchase|purchase\s*rate\s*diff)\b/i;
const CLOSING = /\b(closing\s*stock|cl\.?\s*stock|closing\s*inventory)\b/i;
const NET_PROFIT = /\bnet\s+(profit|loss)\b/i;

function isTradingDebitLabel(label: string): boolean {
  return /^to\s+/i.test(label) && !/\b(gross\s+profit|sale|depreciation|audit|rent|salary|interest|expense|charges|fees|repair|electric|telephone|promotion|printing|bank|shop|staff|late\s+fees)\b/i.test(label);
}

function isTradingCreditLabel(label: string): boolean {
  return /^by\s+/i.test(label) && !/\b(sale|gross\s+profit|incentive|discount|intt|interest|service\s+charges?)\b/i.test(label);
}

function cellLabel(cell: string): string {
  return String(cell ?? '').trim();
}

function findLabelIndex(cells: string[], pattern: RegExp): number {
  return cells.findIndex((c) => pattern.test(cellLabel(c)));
}

function amountsAfterIndex(cells: string[], startIdx: number): number[] {
  return rowNumbers(cells.slice(startIdx + 1));
}

/**
 * Indian pl sheets often put debit and credit sides on one row (e.g. "To Gross Profit … By Closing Stock …").
 */
function parseSplitRow(cells: string[], matchedLabels: string[]): Partial<TradingPeriodComponents> {
  const out: Partial<TradingPeriodComponents> = {};
  const closingIdx = findLabelIndex(cells, CLOSING);
  if (closingIdx >= 0) {
    const after = amountsAfterIndex(cells, closingIdx);
    if (after.length) {
      out.closingStock = Math.max(...after.map((n) => Math.abs(n)));
      matchedLabels.push(cellLabel(cells[closingIdx]));
    }
  }
  return out;
}

/**
 * Parse trading-account components from tabular export text (CSV rows from pl sheet, etc.).
 * Works across layouts where labels mention opening stock, purchases, rate difference, closing stock.
 */
export function extractTradingAccount(sourceText: string): TradingAccountHints | null {
  const lines = String(sourceText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (!lines.length) return null;

  const matchedLabels: string[] = [];
  let openingStock = 0;
  let purchases = 0;
  let rateDifference = 0;
  let closingStock = 0;
  let netProfitCurrent: number | undefined;

  let inTradingSection = false;

  for (const line of lines) {
    if (/trading\s+and\s+profit|profit\s*&\s*loss|profit\s+and\s+loss/i.test(line)) {
      inTradingSection = true;
    }

    const cells = splitLine(line);
    const label = rowLabel(cells);
    const labelLower = label.toLowerCase();

    const splitParts = parseSplitRow(cells, matchedLabels);
    if (splitParts.closingStock != null) {
      closingStock = Math.max(closingStock, splitParts.closingStock);
      inTradingSection = true;
    }

    if (NET_PROFIT.test(labelLower) || cells.some((c) => NET_PROFIT.test(cellLabel(c)))) {
      const nums = rowNumbers(cells);
      if (nums.length) {
        netProfitCurrent = nums[0];
        matchedLabels.push(label || 'net profit');
      }
      continue;
    }

    if (!inTradingSection && !OPENING.test(labelLower) && !PURCHASE.test(labelLower) && findLabelIndex(cells, OPENING) < 0) {
      continue;
    }

    const openingIdx = findLabelIndex(cells, OPENING);
    if (openingIdx >= 0 && /^to\s+/i.test(cellLabel(cells[openingIdx]))) {
      const amt = pickDebitAmount(cells.slice(openingIdx));
      if (amt > 0) {
        openingStock = amt;
        matchedLabels.push(cellLabel(cells[openingIdx]));
        inTradingSection = true;
      }
      continue;
    }

    if (OPENING.test(labelLower) && isTradingDebitLabel(label)) {
      openingStock = pickDebitAmount(cells);
      matchedLabels.push(label);
      inTradingSection = true;
      continue;
    }

    const purchaseIdx = findLabelIndex(cells, PURCHASE);
    if (purchaseIdx >= 0 && /^to\s+/i.test(cellLabel(cells[purchaseIdx])) && !/return/i.test(cellLabel(cells[purchaseIdx]))) {
      const amt = pickDebitAmount(cells.slice(purchaseIdx));
      if (amt > 0) {
        purchases = round2(purchases + amt);
        matchedLabels.push(cellLabel(cells[purchaseIdx]));
        inTradingSection = true;
      }
      continue;
    }

    if (PURCHASE.test(labelLower) && isTradingDebitLabel(label) && !/return/i.test(labelLower)) {
      purchases = round2(purchases + pickDebitAmount(cells));
      matchedLabels.push(label);
      inTradingSection = true;
      continue;
    }

    const rateIdx = findLabelIndex(cells, RATE_DIFF);
    if (rateIdx >= 0 && /^to\s+/i.test(cellLabel(cells[rateIdx]))) {
      const amt = pickDebitAmount(cells.slice(rateIdx));
      if (amt > 0) {
        rateDifference = round2(rateDifference + amt);
        matchedLabels.push(cellLabel(cells[rateIdx]));
        inTradingSection = true;
      }
      continue;
    }

    if (RATE_DIFF.test(labelLower) && isTradingDebitLabel(label)) {
      rateDifference = round2(rateDifference + pickDebitAmount(cells));
      matchedLabels.push(label);
      inTradingSection = true;
      continue;
    }

    const closingIdx = findLabelIndex(cells, CLOSING);
    if (closingIdx >= 0 && /^by\s+/i.test(cellLabel(cells[closingIdx]))) {
      const after = amountsAfterIndex(cells, closingIdx);
      if (after.length) {
        closingStock = Math.max(closingStock, ...after.map((n) => Math.abs(n)));
        matchedLabels.push(cellLabel(cells[closingIdx]));
        inTradingSection = true;
      }
    } else if (CLOSING.test(labelLower) && isTradingCreditLabel(label)) {
      closingStock = Math.max(closingStock, pickCreditAmount(cells));
      matchedLabels.push(label);
      inTradingSection = true;
    }
  }

  const cogs = round2(openingStock + purchases + rateDifference - closingStock);

  let confidence: TradingAccountHints['confidence'] = 'none';
  if (purchases > 0 && cogs > 0 && (openingStock > 0 || closingStock > 0 || rateDifference > 0)) {
    confidence = openingStock > 0 && closingStock > 0 ? 'high' : 'medium';
  } else if (purchases > 0 && cogs > 0) {
    confidence = 'medium';
  } else if (purchases > 0) {
    confidence = 'low';
  }

  if (confidence === 'none') return null;

  return {
    confidence,
    current: { openingStock, purchases, rateDifference, closingStock, cogs },
    netProfitCurrent,
    matchedLabels,
  };
}

export function formatTradingAccountBlock(hints: TradingAccountHints): string {
  const c = hints.current;
  return [
    'PARSED_TRADING_ACCOUNT (deterministic — prefer these COGS components for cost_of_goods_sold.current):',
    `opening_stock: ${c.openingStock}`,
    `purchases: ${c.purchases}`,
    `rate_difference: ${c.rateDifference}`,
    `closing_stock: ${c.closingStock}`,
    `cost_of_goods_sold_computed: ${c.cogs}`,
    hints.netProfitCurrent != null ? `net_profit_current: ${hints.netProfitCurrent}` : null,
    `confidence: ${hints.confidence}`,
  ].filter(Boolean).join('\n');
}
