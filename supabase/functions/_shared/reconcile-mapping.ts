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

/** Balance-sheet plug only — P&L mapping is entirely model-driven. */
export function reconcileMappingResult(
  result: MappingResult,
): { result: MappingResult; adjustments: ReconcileAdjustment[] } {
  const out = structuredClone(result) as MappingResult;
  const adjustments: ReconcileAdjustment[] = [];

  const bs = out.balance_sheet as {
    equity_and_liabilities?: Record<string, Period>;
    assets?: Record<string, Period>;
  } | undefined;

  if (bs?.equity_and_liabilities && bs.assets) {
    for (const period of ['current', 'previous'] as const) {
      const totalLiab = sumSide(bs.equity_and_liabilities, LIAB_KEYS, period);
      const totalAssets = sumSide(bs.assets, ASSET_KEYS, period);
      const diff = round2(totalAssets - totalLiab);
      if (Math.abs(diff) > 1) {
        const ocl = bs.equity_and_liabilities.other_current_liabilities ?? { current: 0, previous: 0 };
        const from = getPeriod(ocl, period);
        const to = round2(from + diff);
        adjustments.push({
          field: 'balance_sheet.equity_and_liabilities.other_current_liabilities',
          period,
          from,
          to,
          reason: 'Books imbalance (suspense) added so total assets = total liabilities',
        });
        setPeriod(bs.equity_and_liabilities, 'other_current_liabilities', period, to);
      }
    }
  }

  if (adjustments.length) {
    out.mapping_adjustments = adjustments;
  }

  return { result: out, adjustments };
}
