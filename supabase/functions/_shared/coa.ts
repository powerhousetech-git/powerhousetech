/** Default chart of accounts templates for book classification. */

export type CoaLedger = {
  name: string;
  group: string;
};

export type CoaTemplate = {
  id: string;
  label: string;
  groups: string[];
  ledgers: CoaLedger[];
};

export const PROPRIETORSHIP_TRADE_COA: CoaTemplate = {
  id: 'proprietorship-trade',
  label: 'Proprietorship — trade & services',
  groups: ['Capital', 'Income', 'Expenses', 'Assets', 'Liabilities'],
  ledgers: [
    { name: 'Capital Account', group: 'Capital' },
    { name: 'Drawings', group: 'Capital' },
    { name: 'Sales - Goods', group: 'Income' },
    { name: 'Sales - Services', group: 'Income' },
    { name: 'Interest Income', group: 'Income' },
    { name: 'Discount Received', group: 'Income' },
    { name: 'Purchases', group: 'Expenses' },
    { name: 'Salaries & Wages', group: 'Expenses' },
    { name: 'Rent', group: 'Expenses' },
    { name: 'Electricity', group: 'Expenses' },
    { name: 'Bank Charges', group: 'Expenses' },
    { name: 'Finance Costs / Interest', group: 'Expenses' },
    { name: 'GST Expense', group: 'Expenses' },
    { name: 'Shop Expenses', group: 'Expenses' },
    { name: 'Depreciation', group: 'Expenses' },
    { name: 'Miscellaneous Expenses', group: 'Expenses' },
    { name: 'Cash in Hand', group: 'Assets' },
    { name: 'Bank - Current Account', group: 'Assets' },
    { name: 'Debtors', group: 'Assets' },
    { name: 'Stock in Trade', group: 'Assets' },
    { name: 'Furniture & Fixtures', group: 'Assets' },
    { name: 'GST Input / Receivable', group: 'Assets' },
    { name: 'TDS Receivable', group: 'Assets' },
    { name: 'Creditors', group: 'Liabilities' },
    { name: 'GST Payable', group: 'Liabilities' },
    { name: 'TDS Payable', group: 'Liabilities' },
    { name: 'CC / Overdraft', group: 'Liabilities' },
    { name: 'Unsecured Loan', group: 'Liabilities' },
    { name: 'Suspense - Review', group: 'Liabilities' },
    { name: 'Inter-account Transfer', group: 'Assets' },
  ],
};

const TEMPLATES: Record<string, CoaTemplate> = {
  [PROPRIETORSHIP_TRADE_COA.id]: PROPRIETORSHIP_TRADE_COA,
};

export function getCoaTemplate(id: string): CoaTemplate {
  return TEMPLATES[id] || PROPRIETORSHIP_TRADE_COA;
}

export function coaLedgerNames(coa: CoaTemplate): string[] {
  return coa.ledgers.map((l) => l.name);
}

export function coaGroupForLedger(coa: CoaTemplate, ledgerName: string): string {
  const found = coa.ledgers.find(
    (l) => l.name.toLowerCase() === ledgerName.toLowerCase(),
  );
  return found?.group ?? 'Expenses';
}
