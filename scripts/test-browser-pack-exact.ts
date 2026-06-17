#!/usr/bin/env -S deno run --allow-read --allow-run

import { buildDeterministicMapping } from '../supabase/functions/_shared/schedule-aggregator.ts';

const path = '/Users/aymaanshahzad23/Downloads/Trial_Balance_ZENITH_FLAT_FY2024.xlsx';

// Exact browser readTallyFile: ALL sheets, double newline join
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
const det = buildDeterministicMapping(pack, null, null);
console.log('all sheets (browser exact):');
console.log('  coverage:', det.deterministic_coverage_pct);
console.log('  revenue:', det.profit_and_loss.revenue_from_operations?.current);
console.log('  finance:', det.profit_and_loss.finance_costs?.current);
console.log('  capital:', det.balance_sheet.equity_and_liabilities.owners_capital?.current);
