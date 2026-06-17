import {
  parseBankStatementText,
  type BankTransaction,
  formatBankBlock,
  resetBankTxnIds,
} from './bank-statement.ts';
import { parseCashBookText, type CashTransaction, formatCashBlock } from './cash-book.ts';
import {
  parseRegisterText,
  type RegisterLine,
  formatRegisterBlock,
} from './register.ts';
import {
  parseOpeningTbText,
  type OpeningLedger,
  formatOpeningTbBlock,
  extraLedgersFromOpening,
} from './opening-tb.ts';

export type RawTxn = {
  id: string;
  date: string;
  narration: string;
  debit: number;
  credit: number;
  balance: number | null;
  sourceFile: string;
  sourceKind: 'bank' | 'cash';
};

export type PackIngestResult = {
  transactions: RawTxn[];
  salesRegister: RegisterLine[];
  purchaseRegister: RegisterLine[];
  openingTb: OpeningLedger[];
  extraLedgers: string[];
  packDataForLlm: string;
  accountsProcessed: string[];
};

function cashToRaw(c: CashTransaction): RawTxn {
  return {
    id: c.id,
    date: c.date,
    narration: c.narration,
    debit: c.payment,
    credit: c.receipt,
    balance: c.balance,
    sourceFile: c.sourceFile,
    sourceKind: 'cash',
  };
}

function bankToRaw(b: BankTransaction): RawTxn {
  return {
    id: b.id,
    date: b.date,
    narration: b.narration,
    debit: b.debit,
    credit: b.credit,
    balance: b.balance,
    sourceFile: b.sourceFile,
    sourceKind: 'bank',
  };
}

/** Ingest combined pack text with --- Sheet/File markers from client. */
export function ingestClientPack(packData: string): PackIngestResult {
  resetBankTxnIds();
  const sections = String(packData || '').split(/---\s*(?:File|Sheet):\s*([^\n-]+)\s*---/i);
  const transactions: RawTxn[] = [];
  const salesRegister: RegisterLine[] = [];
  const purchaseRegister: RegisterLine[] = [];
  let openingTb: OpeningLedger[] = [];
  const accountsProcessed = new Set<string>();
  const blocks: string[] = [];

  function classifyName(name: string): string {
    return name.toLowerCase();
  }

  if (sections.length === 1) {
    const body = sections[0];
    const bank = parseBankStatementText(body, 'upload');
    bank.forEach((b) => {
      transactions.push(bankToRaw(b));
      accountsProcessed.add('bank');
    });
    if (bank.length) blocks.push(formatBankBlock(bank));
  } else {
    for (let i = 1; i < sections.length; i += 2) {
      const fileName = (sections[i] || 'upload').trim();
      const body = sections[i + 1] || '';
      const lower = classifyName(fileName);
      accountsProcessed.add(fileName);

      if (/cash|petty/.test(lower)) {
        const cash = parseCashBookText(body, fileName);
        cash.forEach((c) => transactions.push(cashToRaw(c)));
        blocks.push(formatCashBlock(cash));
      } else if (/sales|outward|gstr-?1/.test(lower)) {
        const sales = parseRegisterText(body, 'sales', fileName);
        salesRegister.push(...sales);
        blocks.push(formatRegisterBlock(sales, 'SALES_REGISTER'));
      } else if (/purchase|inward|gstr-?2/.test(lower)) {
        const purch = parseRegisterText(body, 'purchase', fileName);
        purchaseRegister.push(...purch);
        blocks.push(formatRegisterBlock(purch, 'PURCHASE_REGISTER'));
      } else if (/opening|prior|tb|trial/.test(lower)) {
        openingTb = parseOpeningTbText(body);
        blocks.push(formatOpeningTbBlock(openingTb));
      } else {
        const bank = parseBankStatementText(body, fileName);
        bank.forEach((b) => transactions.push(bankToRaw(b)));
        blocks.push(formatBankBlock(bank));
      }
    }
  }

  const extraLedgers = extraLedgersFromOpening(openingTb);

  const txnLines = transactions.map(
    (t) => `TXN\t${t.id}\t${t.date}\t${t.narration}\t${t.debit}\t${t.credit}\t${t.sourceFile}`,
  );

  const packDataForLlm = [...txnLines, '', ...blocks].join('\n');

  return {
    transactions,
    salesRegister,
    purchaseRegister,
    openingTb,
    extraLedgers,
    packDataForLlm,
    accountsProcessed: [...accountsProcessed],
  };
}
