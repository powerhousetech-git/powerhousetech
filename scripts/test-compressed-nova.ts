#!/usr/bin/env -S deno run --allow-read --allow-run

import { buildDeterministicMapping } from '../supabase/functions/_shared/schedule-aggregator.ts';

const path = '/Users/aymaanshahzad23/Downloads/Trial_Balance_ZENITH_FLAT_FY2024.xlsx';

/** Mirrors readTallyFile + compressTallyForMapping (post-fix: full pack preserved). */
async function browserPack(path: string, skipReadme = true): Promise<string> {
  const cmd = new Deno.Command('python3', {
    args: ['-c', `
import pandas as pd, sys
path = sys.argv[1]
skip = sys.argv[2] == '1'
xl = pd.ExcelFile(path)
parts = []
for name in xl.sheet_names:
    if skip and name.lower() == 'readme':
        continue
    df = pd.read_excel(path, sheet_name=name, header=None)
    df = df.map(lambda x: str(x).replace('\\n', ' ').strip() if isinstance(x, str) else x)
    parts.append('--- Sheet: ' + name + ' ---\\n' + df.to_csv(index=False, header=False))
print(''.join(parts))
`, path, skipReadme ? '1' : '0'],
    stdout: 'piped',
  });
  const { code, stdout, stderr } = await cmd.output();
  if (code !== 0) throw new Error(new TextDecoder().decode(stderr));
  return new TextDecoder().decode(stdout);
}

const pack = await browserPack(path, true);
const det = buildDeterministicMapping(pack, null, null);
const rev = det.profit_and_loss.revenue_from_operations?.current ?? 0;
const cap = det.balance_sheet.equity_and_liabilities.owners_capital?.current ?? 0;

console.log('browser pack (post-fix):');
console.log('  coverage:', det.deterministic_coverage_pct, 'confidence:', det.mapping_confidence);
console.log('  revenue:', rev);
console.log('  owners_capital:', cap);

const ok = Math.abs(rev - 25_954_489) < 100
  && Math.abs(cap - 10_660_537.35) < 100
  && det.deterministic_coverage_pct >= 70;
if (!ok) {
  console.log('\n✗ compressed-nova browser pack test failed');
  Deno.exit(1);
}
console.log('\n✓ browser pack matches NOVA answer key');
