#!/usr/bin/env -S deno run --allow-read --allow-run

import { extractTradingAccount } from '../supabase/functions/_shared/trading-account.ts';
import { extractBalanceSheetHints } from '../supabase/functions/_shared/balance-sheet.ts';
import {
  buildDeterministicMapping,
  deterministicToMappingResult,
} from '../supabase/functions/_shared/schedule-aggregator.ts';
import { reconcileMappingResult } from '../supabase/functions/_shared/reconcile-mapping.ts';

const path = '/Users/aymaanshahzad23/Downloads/Trial_Balance_ZENITH_FLAT_FY2024.xlsx';
const cmd = new Deno.Command('python3', {
  args: ['-c', `
import pandas as pd, sys
path = sys.argv[1]
xl = pd.ExcelFile(path)
parts = []
for name in xl.sheet_names:
    df = pd.read_excel(path, sheet_name=name, header=None)
    rows = []
    for _, row in df.iterrows():
        cells = []
        for x in row:
            s = str(x).replace('\\n', ' ').strip() if pd.notna(x) and str(x) != 'nan' else ''
            if not s: cells.append('')
            elif any(c in s for c in '",\\n'): cells.append('"' + s.replace('"', '""') + '"')
            else: cells.append(s)
        rows.append(','.join(cells))
    parts.append('--- Sheet: ' + name + ' ---\\n' + '\\n'.join(rows))
print('\\n\\n'.join(parts))
`, path],
  stdout: 'piped',
});
const { stdout } = await cmd.output();
const pack = new TextDecoder().decode(stdout);

const trading = extractTradingAccount(pack);
const balance = extractBalanceSheetHints(pack);
console.log('server trading hints:', trading?.confidence, trading?.current);
console.log('server balance hints:', balance?.confidence, balance?.current);

const det = buildDeterministicMapping(pack, trading, balance);
const { result } = reconcileMappingResult(
  deterministicToMappingResult(det, 'NOVA', '2024-03-31', '2023-03-31'),
  trading,
  balance,
);

const pl = result.profit_and_loss as Record<string, { current: number }>;
const bs = result.balance_sheet as { equity_and_liabilities: Record<string, { current: number }> };
console.log('\nAfter full server pipeline:');
console.log('  revenue:', pl.revenue_from_operations?.current);
console.log('  cogs:', pl.cost_of_goods_sold?.current);
console.log('  finance:', pl.finance_costs?.current);
console.log('  capital:', bs.equity_and_liabilities.owners_capital?.current);
