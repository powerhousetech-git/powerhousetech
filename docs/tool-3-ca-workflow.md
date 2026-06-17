# Tool 3: Client pack → intermediary books → draft trial balance

Working paper automation for Indian CA practices. Outputs are **reviewed by the CA** before Tool 1 (TB → NCE) or any filing.

## Discovery capture (Powerhouse internal)

Validated with proprietorship trade/services clients (tyre dealers, fabricators, service centres). Rules below are defaults for v1 classification.

### Manual rules CAs apply (automate where safe)

| Pattern | Typical ledger | Notes |
|---------|----------------|-------|
| UPI/IMPS to proprietor name | Drawings | Not business expense |
| Cash deposited to bank | Contra / cash | Pair with bank credit |
| NEFT/RTGS from known debtor | Debtors / receipts | Match register if present |
| GST payment (CBDT/CGST) | GST payable | Split IGST/CGST/SGST when narration allows |
| Salary NEFT batch | Salaries | |
| Loan EMI (principal + interest) | Split loan + finance costs | Often single narration — flag for review |
| Bank charges | Bank charges | |
| Interest credit on FD/CC | Interest income / finance costs | |
| Transfer between own accounts | Inter-account transfer | Exclude from P&L |
| MRF / supplier payment | Creditors / purchases | Match purchase register |

### What CAs will not trust without review

- Personal vs business split on ambiguous UPI
- Loan EMI principal/interest split from narration only
- Revenue recognition timing vs register
- Opening balance mapping when client COA differs from firm template

## Raw inputs (Tier A — v1)

| Input | Formats | Required |
|-------|---------|----------|
| Bank statements | CSV, Excel, PDF (text extracted client-side) | At least one |
| Cash book | CSV, Excel | Optional |
| Sales register | CSV, Excel | Optional (milestone 3.2) |
| Purchase register | CSV, Excel | Optional (milestone 3.2) |
| Opening / prior-year TB | CSV, Excel | Optional (milestone 3.2) |

## Intermediary outputs (not final products)

1. **Classified bank book** — date, narration, debit, credit, balance, ledger head, confidence, transfer flag
2. **Ledger head summary** — opening, debits, credits, closing per firm COA head
3. **Day book** — voucher-style rows for Tally import prep
4. **Draft trial balance** — Ledger | Debit | Credit (handoff to Tool 1)
5. **Review pack** — unmapped lines, adjustments, notes to preparer, stats

## Handoff to Tool 1

Download draft TB as Excel/CSV or use **Send to NCE conversion** to pre-fill the TB → NCE tab with the same file text Tool 1 already accepts.

## Fixture packs

See `fixtures/tool-3/` for synthetic input packs (no golden financial statements — input only).
