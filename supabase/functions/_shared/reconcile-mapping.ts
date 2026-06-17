import type { TradingAccountHints } from './trading-account.ts';
import type { BalanceSheetHints } from './balance-sheet.ts';

type Period = { current: number; previous: number };

type MappingResult = Record<string, unknown>;

const LIAB_KEYS = [
  'owners_capital',
  'long_term_borrowings',
  'other_long_term_liabilities',
  'long_term_provisions',
  'short_term_borrowings',
  'trade_payables',
  'other_current_liabilities',
  'short_term_provisions',
] as const;

const ASSET_KEYS = [
  'property_plant_equipment',
  'intangible_assets',
  'capital_wip',
  'non_current_investments',
  'long_term_loans_advances',
  'other_non_current_assets',
  'current_investments',
  'inventories',
  'trade_receivables',
  'cash_and_bank',
  'short_term_loans_advances',
  'other_current_assets',
] as const;

const PL_EXPENSE_KEYS = [
  'cost_of_goods_sold',
  'employee_benefits_expense',
  'finance_costs',
  'depreciation_amortization',
  'other_expenses',
] as const;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function getPeriod(obj: unknown, key: 'current' | 'previous'): number {
  if (!obj || typeof obj !== 'object') return 0;
  return num((obj as Period)[key]);
}

function setPeriod(obj: Record<string, Period>, key: string, period: 'current' | 'previous', value: number) {
  if (!obj[key]) obj[key] = { current: 0, previous: 0 };
  obj[key][period] = round2(value);
}

function sumSide(side: Record<string, Period>, keys: readonly string[], period: 'current' | 'previous'): number {
  return round2(keys.reduce((sum, key) => sum + getPeriod(side[key], period), 0));
}

export interface ReconcileAdjustment {
  field: string;
  period: 'current' | 'previous';
  from: number;
  to: number;
  reason: string;
}

function shouldApplyCogsHint(mapped: number, expected: number): boolean {
  if (expected <= 0) return false;
  const diff = Math.abs(expected - mapped);
  return diff > Math.max(500, Math.abs(expected) * 0.002);
}

function reconcileCogsFromTradingAccount(
  out: MappingResult,
  hints: TradingAccountHints,
  adjustments: ReconcileAdjustment[],
): void {
  if (hints.confidence === 'low' || hints.confidence === 'none') return;

  const pl = out.profit_and_loss as Record<string, Period> | undefined;
  if (!pl) return;

  const expected = hints.current.cogs;
  if (expected <= 0) return;

  const cogs = pl.cost_of_goods_sold ?? { current: 0, previous: 0 };
  pl.cost_of_goods_sold = cogs;
  const mapped = getPeriod(cogs, 'current');

  if (!shouldApplyCogsHint(mapped, expected)) return;

  adjustments.push({
    field: 'profit_and_loss.cost_of_goods_sold',
    period: 'current',
    from: mapped,
    to: expected,
    reason: 'COGS recomputed from opening stock + purchases + rate difference − closing stock in source trading account',
  });
  setPeriod(pl, 'cost_of_goods_sold', 'current', expected);

  const notes = (out.notes ?? {}) as Record<string, unknown>;
  out.notes = notes;
  const inv = (notes.inventories_breakup ?? {}) as Record<string, Period>;
  notes.inventories_breakup = inv;
  if (hints.current.openingStock > 0) {
    setPeriod(inv as Record<string, Period>, 'stock_in_trade_opening', 'current', hints.current.openingStock);
  }
  if (hints.current.closingStock > 0) {
    setPeriod(inv as Record<string, Period>, 'stock_in_trade_closing', 'current', hints.current.closingStock);
  }
}

function reconcileCogsFromInventoryNotes(
  out: MappingResult,
  adjustments: ReconcileAdjustment[],
): void {
  const pl = out.profit_and_loss as Record<string, Period> | undefined;
  const notes = out.notes as { inventories_breakup?: Record<string, Period> } | undefined;
  const inv = notes?.inventories_breakup;
  if (!pl || !inv) return;

  const opening = getPeriod(inv.stock_in_trade_opening, 'current') + getPeriod(inv.wip_opening, 'current');
  const closing = getPeriod(inv.stock_in_trade_closing, 'current') + getPeriod(inv.wip_closing, 'current');
  if (opening <= 0 && closing <= 0) return;

  const mapped = getPeriod(pl.cost_of_goods_sold, 'current');
  // Only use notes alone when mapped COGS is already close to a stock-adjusted figure (model tried but missed a component).
  const impliedMin = round2(Math.max(0, opening - closing));
  if (mapped < impliedMin * 0.5) return;

  const expected = round2(mapped + (opening - closing));
  if (!shouldApplyCogsHint(mapped, expected)) return;

  adjustments.push({
    field: 'profit_and_loss.cost_of_goods_sold',
    period: 'current',
    from: mapped,
    to: expected,
    reason: 'COGS adjusted using opening/closing stock from notes.inventories_breakup',
  });
  setPeriod(pl, 'cost_of_goods_sold', 'current', expected);
}

function applyBsHint(
  side: Record<string, Period>,
  key: string,
  hintValue: number | undefined,
  period: 'current' | 'previous',
  adjustments: ReconcileAdjustment[],
  label: string,
): void {
  if (hintValue == null || hintValue <= 0) return;
  const mapped = getPeriod(side[key], period);
  if (Math.abs(mapped - hintValue) <= Math.max(100, hintValue * 0.01)) return;
  adjustments.push({
    field: `balance_sheet.*.${key}`,
    period,
    from: mapped,
    to: hintValue,
    reason: `${label} aligned to parsed balance sheet figure`,
  });
  setPeriod(side, key, period, hintValue);
}

function reconcileBalanceSheetFromHints(
  out: MappingResult,
  hints: BalanceSheetHints,
  adjustments: ReconcileAdjustment[],
): void {
  if (hints.confidence === 'low' || hints.confidence === 'none') return;

  const bs = out.balance_sheet as {
    equity_and_liabilities?: Record<string, Period>;
    assets?: Record<string, Period>;
  } | undefined;
  if (!bs?.equity_and_liabilities || !bs.assets) return;

  const eq = bs.equity_and_liabilities;
  const assets = bs.assets;
  const c = hints.current;

  applyBsHint(eq, 'long_term_borrowings', c.long_term_borrowings, 'current', adjustments, 'Long-term borrowings');
  applyBsHint(eq, 'short_term_borrowings', c.short_term_borrowings, 'current', adjustments, 'Short-term borrowings');
  applyBsHint(eq, 'trade_payables', c.trade_payables, 'current', adjustments, 'Trade payables');
  applyBsHint(eq, 'other_current_liabilities', c.other_current_liabilities, 'current', adjustments, 'Other current liabilities');
  applyBsHint(assets, 'long_term_loans_advances', c.long_term_loans_advances, 'current', adjustments, 'Long-term loans & advances');
  applyBsHint(assets, 'short_term_loans_advances', c.short_term_loans_advances, 'current', adjustments, 'Short-term loans & advances');
  if (c.other_current_assets > 0) {
    applyBsHint(assets, 'other_current_assets', c.other_current_assets, 'current', adjustments, 'Other current assets');
  }
}

function reconcileBooksImbalance(
  out: MappingResult,
  bsHints: BalanceSheetHints | null | undefined,
  adjustments: ReconcileAdjustment[],
): void {
  const bs = out.balance_sheet as {
    equity_and_liabilities?: Record<string, Period>;
    assets?: Record<string, Period>;
  } | undefined;
  if (!bs?.equity_and_liabilities || !bs.assets) return;

  for (const period of ['current', 'previous'] as const) {
    const totalLiab = sumSide(bs.equity_and_liabilities, LIAB_KEYS, period);
    const totalAssets = sumSide(bs.assets, ASSET_KEYS, period);
    let diff = round2(totalAssets - totalLiab);
    if (Math.abs(diff) <= 1) continue;

    const ocl = bs.equity_and_liabilities.other_current_liabilities ?? { current: 0, previous: 0 };
    const oclVal = getPeriod(ocl, period);
    const hintedOcl = period === 'current' ? bsHints?.current.other_current_liabilities : undefined;

    // Undo hidden plug in other current liabilities when parser found the real creditor total.
    if (hintedOcl != null && oclVal > hintedOcl + 1000 && Math.abs(diff) < Math.abs(oclVal - hintedOcl) * 1.1) {
      adjustments.push({
        field: 'balance_sheet.equity_and_liabilities.other_current_liabilities',
        period,
        from: oclVal,
        to: hintedOcl,
        reason: 'Removed book imbalance plug from other current liabilities',
      });
      setPeriod(bs.equity_and_liabilities, 'other_current_liabilities', period, hintedOcl);
      diff = round2(totalAssets - sumSide(bs.equity_and_liabilities, LIAB_KEYS, period));
    }

    const suspenseKey = 'other_long_term_liabilities';
    const suspense = bs.equity_and_liabilities[suspenseKey] ?? { current: 0, previous: 0 };
    const from = getPeriod(suspense, period);
    const to = round2(from + diff);

    adjustments.push({
      field: `balance_sheet.equity_and_liabilities.${suspenseKey}`,
      period,
      from,
      to,
      reason: 'Books imbalance disclosed as other long-term liabilities (suspense pending reconciliation)',
    });
    setPeriod(bs.equity_and_liabilities, suspenseKey, period, to);

    const notes = (out.notes ?? {}) as Record<string, unknown>;
    out.notes = notes;
    notes.books_suspense_disclosed = true;
  }
}

function reconcileOtherExpensesDoubleCount(
  out: MappingResult,
  hints: TradingAccountHints,
  adjustments: ReconcileAdjustment[],
): void {
  if (!hints.current.rateDifference || hints.confidence === 'low') return;

  const pl = out.profit_and_loss as Record<string, Period> | undefined;
  if (!pl) return;

  const other = pl.other_expenses ?? { current: 0, previous: 0 };
  pl.other_expenses = other;
  const otherCurrent = getPeriod(other, 'current');
  const rate = hints.current.rateDifference;

  if (otherCurrent >= rate && otherCurrent - rate > 1000) {
    const adjusted = round2(otherCurrent - rate);
    const cogsNow = getPeriod(pl.cost_of_goods_sold, 'current');
    if (Math.abs(cogsNow - hints.current.cogs) <= Math.max(500, hints.current.cogs * 0.01)) {
      adjustments.push({
        field: 'profit_and_loss.other_expenses',
        period: 'current',
        from: otherCurrent,
        to: adjusted,
        reason: 'Removed rate difference from other_expenses (belongs in COGS)',
      });
      setPeriod(pl, 'other_expenses', 'current', adjusted);
    }
  }
}

export function reconcileMappingResult(
  result: MappingResult,
  tradingHints?: TradingAccountHints | null,
  balanceHints?: BalanceSheetHints | null,
): { result: MappingResult; adjustments: ReconcileAdjustment[] } {
  const out = structuredClone(result) as MappingResult;
  const adjustments: ReconcileAdjustment[] = [];

  if (tradingHints) {
    reconcileCogsFromTradingAccount(out, tradingHints, adjustments);
    reconcileOtherExpensesDoubleCount(out, tradingHints, adjustments);
  } else {
    reconcileCogsFromInventoryNotes(out, adjustments);
  }

  if (balanceHints) {
    reconcileBalanceSheetFromHints(out, balanceHints, adjustments);
  }

  reconcileBooksImbalance(out, balanceHints, adjustments);

  if (adjustments.length) {
    out.mapping_adjustments = adjustments;
  }

  return { result: out, adjustments };
}

/** Sum P&L expense lines (for client-side derived profit). */
export function sumPlExpenses(pl: Record<string, Period> | undefined, period: 'current' | 'previous'): number {
  if (!pl) return 0;
  return round2(PL_EXPENSE_KEYS.reduce((sum, key) => sum + getPeriod(pl[key], period), 0));
}
