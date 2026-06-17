import type { CoaTemplate } from './coa.ts';
import { coaGroupForLedger, getCoaTemplate } from './coa.ts';
import type { OpeningLedger } from './opening-tb.ts';
import type { RegisterLine } from './register.ts';
import type { RawTxn } from './pack-ingest.ts';

export type ClassifiedTxn = {
  id: string;
  date: string;
  narration: string;
  debit: number;
  credit: number;
  balance: number | null;
  ledger: string;
  group: string;
  confidence: 'high' | 'medium' | 'low';
  is_transfer: boolean;
  is_personal: boolean;
  source_file: string;
  source_kind: 'bank' | 'cash';
  voucher_type: string;
};

export type LedgerSummaryRow = {
  ledger: string;
  group: string;
  opening: number;
  debit: number;
  credit: number;
  closing: number;
};

export type DayBookRow = {
  date: string;
  voucher_type: string;
  ledger: string;
  debit: number;
  credit: number;
  narration: string;
};

export type TrialBalanceRow = {
  ledger: string;
  debit: number;
  credit: number;
};

export type BookBuildResult = {
  entity_name: string;
  fy_end: string;
  prev_fy_end: string;
  coa_template_id: string;
  classified_transactions: ClassifiedTxn[];
  ledger_summary: LedgerSummaryRow[];
  day_book: DayBookRow[];
  draft_trial_balance: TrialBalanceRow[];
  unmapped_transactions: { id: string; reason: string }[];
  mapping_adjustments: { field: string; from: string; to: string; reason: string }[];
  notes_to_preparer: string;
  stats: {
    transaction_count: number;
    classified_by_value_pct: number;
    accounts_processed: string[];
    date_from: string;
    date_to: string;
  };
  tally_tb_text: string;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const RULES: { pattern: RegExp; ledger: string; voucher?: string; transfer?: boolean; personal?: boolean }[] = [
  { pattern: /\bdraw(ing)?s?\b|proprietor|partner\s+draw/i, ledger: 'Drawings', personal: true },
  { pattern: /\bbank\s*charg|chg\b|service\s*charg/i, ledger: 'Bank Charges' },
  { pattern: /\bgst\s*pay|cgst|igst|sgst/i, ledger: 'GST Payable' },
  { pattern: /\bsalar|wages|payroll/i, ledger: 'Salaries & Wages' },
  { pattern: /\brent\b/i, ledger: 'Rent' },
  { pattern: /\belectric|power\b/i, ledger: 'Electricity' },
  { pattern: /\binterest\b|\bint\b.*\bapr|\bcc\s*int/i, ledger: 'Finance Costs / Interest' },
  { pattern: /\binterest\s*(cr|credit|received)/i, ledger: 'Interest Income', voucher: 'Receipt' },
  { pattern: /\bneft\s*[- ]*cr|\bcr\b.*\bsale|\bsale\b|\bcustomer\b/i, ledger: 'Sales - Goods', voucher: 'Receipt' },
  { pattern: /\bpurchase|\bmrf\b|\bsupplier\b/i, ledger: 'Purchases', voucher: 'Payment' },
  { pattern: /\bdeposit.*bank|\bto\s*bank\b|\bcash\s*dep/i, ledger: 'Inter-account Transfer', transfer: true, voucher: 'Contra' },
  { pattern: /\bwithdraw.*cash|\bfrom\s*bank\b/i, ledger: 'Inter-account Transfer', transfer: true, voucher: 'Contra' },
];

function ruleClassify(narration: string): {
  ledger: string;
  confidence: ClassifiedTxn['confidence'];
  is_transfer: boolean;
  is_personal: boolean;
  voucher_type: string;
} | null {
  const n = narration.toLowerCase();
  for (const r of RULES) {
    if (r.pattern.test(n)) {
      return {
        ledger: r.ledger,
        confidence: 'high',
        is_transfer: r.transfer ?? false,
        is_personal: r.personal ?? false,
        voucher_type: r.voucher ?? (r.ledger.includes('Sales') ? 'Receipt' : 'Payment'),
      };
    }
  }
  return null;
}

function mergeClassified(
  raw: RawTxn[],
  llmMap: Map<string, { ledger?: string; confidence?: string; is_transfer?: boolean; is_personal?: boolean; voucher_type?: string }>,
  coa: CoaTemplate,
): {
  txns: ClassifiedTxn[];
  unmapped: { id: string; reason: string }[];
  adjustments: BookBuildResult['mapping_adjustments'];
} {
  const txns: ClassifiedTxn[] = [];
  const unmapped: { id: string; reason: string }[] = [];
  const adjustments: BookBuildResult['mapping_adjustments'] = [];

  for (const t of raw) {
    const fromLlm = llmMap.get(t.id);
    const fromRule = ruleClassify(t.narration);
    let ledger = fromLlm?.ledger || fromRule?.ledger || 'Suspense - Review';
    let confidence: ClassifiedTxn['confidence'] =
      (fromLlm?.confidence as ClassifiedTxn['confidence']) || (fromRule ? 'high' : 'low');

    if (fromRule && fromLlm?.ledger && fromLlm.ledger !== fromRule.ledger) {
      adjustments.push({
        field: t.id,
        from: fromLlm.ledger,
        to: fromRule.ledger,
        reason: 'Deterministic narration rule overrode model classification',
      });
      ledger = fromRule.ledger;
      confidence = 'high';
    }

    if (ledger === 'Suspense - Review') {
      if (t.credit > 0 && !fromLlm) {
        ledger = 'Sales - Goods';
        confidence = 'medium';
      } else if (t.debit > 0 && !fromLlm) {
        ledger = 'Miscellaneous Expenses';
        confidence = 'medium';
      } else {
        unmapped.push({ id: t.id, reason: 'Could not classify narration' });
      }
    }

    const group = coaGroupForLedger(coa, ledger);
    txns.push({
      id: t.id,
      date: t.date,
      narration: t.narration,
      debit: t.debit,
      credit: t.credit,
      balance: t.balance,
      ledger,
      group,
      confidence,
      is_transfer: fromLlm?.is_transfer ?? fromRule?.is_transfer ?? false,
      is_personal: fromLlm?.is_personal ?? fromRule?.is_personal ?? false,
      source_file: t.sourceFile,
      source_kind: t.sourceKind,
      voucher_type: fromLlm?.voucher_type || fromRule?.voucher_type || (t.credit > 0 ? 'Receipt' : 'Payment'),
    });
  }

  return { txns, unmapped, adjustments };
}

function applyRegisterPostings(
  summary: Map<string, LedgerSummaryRow>,
  sales: RegisterLine[],
  purchases: RegisterLine[],
  coa: CoaTemplate,
): void {
  const add = (ledger: string, debit: number, credit: number) => {
    const row = summary.get(ledger) || {
      ledger,
      group: coaGroupForLedger(coa, ledger),
      opening: 0,
      debit: 0,
      credit: 0,
      closing: 0,
    };
    row.debit = round2(row.debit + debit);
    row.credit = round2(row.credit + credit);
    summary.set(ledger, row);
  };

  for (const s of sales) {
    add('Sales - Goods', 0, s.taxable);
    add('Debtors', s.total, 0);
  }
  for (const p of purchases) {
    add('Purchases', p.taxable, 0);
    add('Creditors', 0, p.total);
  }
}

export function reconcileBooks({
  entityName,
  fyEnd,
  prevFyEnd,
  coaTemplateId,
  rawTxns,
  llmClassified,
  openingTb,
  salesRegister,
  purchaseRegister,
  accountsProcessed,
  notesToPreparer = '',
}: {
  entityName: string;
  fyEnd: string;
  prevFyEnd: string;
  coaTemplateId: string;
  rawTxns: RawTxn[];
  llmClassified: { id: string; ledger?: string; confidence?: string; is_transfer?: boolean; is_personal?: boolean; voucher_type?: string }[];
  openingTb: OpeningLedger[];
  salesRegister: RegisterLine[];
  purchaseRegister: RegisterLine[];
  accountsProcessed: string[];
  notesToPreparer?: string;
}): BookBuildResult {
  const coa = getCoaTemplate(coaTemplateId);
  const llmMap = new Map(llmClassified.map((c) => [c.id, c]));

  const { txns, unmapped, adjustments } = mergeClassified(rawTxns, llmMap, coa);

  const summary = new Map<string, LedgerSummaryRow>();

  for (const o of openingTb) {
    summary.set(o.ledger, {
      ledger: o.ledger,
      group: coaGroupForLedger(coa, o.ledger),
      opening: round2(o.debit - o.credit),
      debit: 0,
      credit: 0,
      closing: 0,
    });
  }

  applyRegisterPostings(summary, salesRegister, purchaseRegister, coa);

  for (const t of txns) {
    if (t.is_transfer) continue;
    const bankLedger = t.source_kind === 'cash' ? 'Cash in Hand' : 'Bank - Current Account';

    const row = summary.get(t.ledger) || {
      ledger: t.ledger,
      group: t.group,
      opening: 0,
      debit: 0,
      credit: 0,
      closing: 0,
    };
    row.debit = round2(row.debit + t.debit);
    row.credit = round2(row.credit + t.credit);
    summary.set(t.ledger, row);

    const bankRow = summary.get(bankLedger) || {
      ledger: bankLedger,
      group: 'Assets',
      opening: 0,
      debit: 0,
      credit: 0,
      closing: 0,
    };
    bankRow.debit = round2(bankRow.debit + t.credit);
    bankRow.credit = round2(bankRow.credit + t.debit);
    summary.set(bankLedger, bankRow);
  }

  const ledger_summary: LedgerSummaryRow[] = [];
  for (const row of summary.values()) {
    row.closing = round2(row.opening + row.debit - row.credit);
    ledger_summary.push(row);
  }
  ledger_summary.sort((a, b) => a.ledger.localeCompare(b.ledger));

  const day_book: DayBookRow[] = txns
    .filter((t) => !t.is_transfer)
    .flatMap((t) => {
      const bankLedger = t.source_kind === 'cash' ? 'Cash in Hand' : 'Bank - Current Account';
      const rows: DayBookRow[] = [];
      if (t.debit > 0) {
        rows.push({
          date: t.date,
          voucher_type: t.voucher_type || 'Payment',
          ledger: t.ledger,
          debit: t.debit,
          credit: 0,
          narration: t.narration,
        });
        rows.push({
          date: t.date,
          voucher_type: 'Payment',
          ledger: bankLedger,
          debit: 0,
          credit: t.debit,
          narration: t.narration,
        });
      }
      if (t.credit > 0) {
        rows.push({
          date: t.date,
          voucher_type: t.voucher_type || 'Receipt',
          ledger: bankLedger,
          debit: t.credit,
          credit: 0,
          narration: t.narration,
        });
        rows.push({
          date: t.date,
          voucher_type: 'Receipt',
          ledger: t.ledger,
          debit: 0,
          credit: t.credit,
          narration: t.narration,
        });
      }
      return rows;
    });

  const draft_trial_balance: TrialBalanceRow[] = ledger_summary
    .filter((r) => Math.abs(r.closing) > 0.01)
    .map((r) => ({
      ledger: r.ledger,
      debit: r.closing > 0 ? round2(r.closing) : 0,
      credit: r.closing < 0 ? round2(Math.abs(r.closing)) : 0,
    }));

  let dr = 0;
  let cr = 0;
  for (const row of draft_trial_balance) {
    dr += row.debit;
    cr += row.credit;
  }
  const diff = round2(dr - cr);
  if (Math.abs(diff) > 1) {
    draft_trial_balance.push({
      ledger: 'Suspense - Review',
      debit: diff < 0 ? Math.abs(diff) : 0,
      credit: diff > 0 ? diff : 0,
    });
    adjustments.push({
      field: 'draft_trial_balance',
      from: String(diff),
      to: 'Suspense - Review',
      reason: 'Books imbalance disclosed in suspense pending review',
    });
  }

  const dates = txns.map((t) => t.date).filter(Boolean).sort();
  const totalValue = txns.reduce((s, t) => s + t.debit + t.credit, 0);
  const classifiedValue = txns
    .filter((t) => t.ledger !== 'Suspense - Review' && t.confidence !== 'low')
    .reduce((s, t) => s + t.debit + t.credit, 0);

  const tally_tb_text = [
    'Trial balance rows (generated from client pack):',
    'Ledger Name\tDebit\tCredit',
    ...draft_trial_balance.map((r) => `${r.ledger}\t${r.debit || ''}\t${r.credit || ''}`),
  ].join('\n');

  return {
    entity_name: entityName,
    fy_end: fyEnd,
    prev_fy_end: prevFyEnd,
    coa_template_id: coaTemplateId,
    classified_transactions: txns,
    ledger_summary,
    day_book,
    draft_trial_balance,
    unmapped_transactions: unmapped,
    mapping_adjustments: adjustments,
    notes_to_preparer: notesToPreparer,
    stats: {
      transaction_count: txns.length,
      classified_by_value_pct: totalValue > 0 ? round2((classifiedValue / totalValue) * 100) : 0,
      accounts_processed: accountsProcessed,
      date_from: dates[0] || '',
      date_to: dates[dates.length - 1] || '',
    },
    tally_tb_text,
  };
}
