import { tallySystemPrompt } from './tally-system-prompt.ts';
import { reconcileMappingResult } from './reconcile-mapping.ts';
import { extractTradingAccount, formatTradingAccountBlock } from './trading-account.ts';
import { extractBalanceSheetHints, formatBalanceSheetBlock } from './balance-sheet.ts';

export const MAX_TALLY_CHARS = 80000;

export async function mapTallyWithClaude({
  entityName,
  fyEnd,
  prevFyEnd,
  tallyData,
  apiKey,
}: {
  entityName: string;
  fyEnd: string;
  prevFyEnd: string;
  tallyData: string;
  apiKey: string;
}): Promise<Record<string, unknown>> {
  const trimmed = String(tallyData || '').slice(0, MAX_TALLY_CHARS);
  if (!trimmed.trim()) {
    throw new Error('tallyData is required');
  }

  const tradingHints = extractTradingAccount(trimmed);
  const balanceHints = extractBalanceSheetHints(trimmed);
  const tradingBlock = tradingHints ? `\n\n${formatTradingAccountBlock(tradingHints)}\n` : '';
  const balanceBlock = balanceHints ? `\n\n${formatBalanceSheetBlock(balanceHints)}\n` : '';

  const userMessage =
    `Entity: ${entityName}\nFinancial year end: ${fyEnd}\nPrevious year end: ${prevFyEnd}\n\nTALLY EXPORT DATA:\n${trimmed}${tradingBlock}${balanceBlock}`;

  const anthropicResp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: tallySystemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  const anthropicBody = await anthropicResp.json().catch(() => ({}));

  if (!anthropicResp.ok) {
    throw new Error(`Mapping service error (HTTP ${anthropicResp.status})`);
  }

  const rawText = (anthropicBody as { content?: { type: string; text?: string }[] })
    .content?.find((b) => b.type === 'text')?.text || '';
  const clean = rawText.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(clean);
  } catch {
    throw new Error('Invalid mapping response from service');
  }

  const { result } = reconcileMappingResult(parsed, tradingHints, balanceHints);
  return result;
}
