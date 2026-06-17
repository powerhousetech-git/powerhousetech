import { getCoaTemplate } from './coa.ts';
import { bookClassifySystemPrompt, buildClassifyUserMessage } from './book-classify-prompt.ts';
import { ingestClientPack } from './pack-ingest.ts';
import { reconcileBooks, type BookBuildResult } from './reconcile-books.ts';

export const MAX_PACK_CHARS = 80000;

export async function buildBooksWithClaude({
  entityName,
  fyEnd,
  prevFyEnd,
  coaTemplateId,
  packData,
  apiKey,
  dryRun = false,
}: {
  entityName: string;
  fyEnd: string;
  prevFyEnd: string;
  coaTemplateId: string;
  packData: string;
  apiKey: string;
  dryRun?: boolean;
}): Promise<BookBuildResult> {
  const trimmed = String(packData || '').slice(0, MAX_PACK_CHARS);
  if (!trimmed.trim()) {
    throw new Error('packData is required');
  }

  const ingested = ingestClientPack(trimmed);
  if (
    !ingested.transactions.length &&
    !ingested.salesRegister.length &&
    !ingested.purchaseRegister.length &&
    !ingested.openingTb.length
  ) {
    throw new Error('No transactions found in uploaded files. Use bank CSV/Excel or PDF text export.');
  }

  const coa = getCoaTemplate(coaTemplateId);

  let llmClassified: { id: string; ledger?: string; confidence?: string; is_transfer?: boolean; is_personal?: boolean; voucher_type?: string }[] = [];
  let notesToPreparer = '';

  if (!dryRun && ingested.transactions.length > 0) {
    const userMessage = buildClassifyUserMessage({
      entityName,
      fyEnd,
      coa,
      packData: ingested.packDataForLlm,
      extraLedgers: ingested.extraLedgers,
    });

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
        system: bookClassifySystemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    const anthropicBody = await anthropicResp.json().catch(() => ({}));
    if (!anthropicResp.ok) {
      throw new Error(`Classification service error (HTTP ${anthropicResp.status})`);
    }

    const rawText = (anthropicBody as { content?: { type: string; text?: string }[] })
      .content?.find((b) => b.type === 'text')?.text || '';
    const clean = rawText.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();

    try {
      const parsed = JSON.parse(clean) as {
        classified_transactions?: typeof llmClassified;
        notes_to_preparer?: string;
      };
      llmClassified = parsed.classified_transactions || [];
      notesToPreparer = String(parsed.notes_to_preparer || '');
    } catch {
      throw new Error('Invalid classification response from service');
    }
  }

  return reconcileBooks({
    entityName,
    fyEnd,
    prevFyEnd,
    coaTemplateId,
    rawTxns: ingested.transactions,
    llmClassified,
    openingTb: ingested.openingTb,
    salesRegister: ingested.salesRegister,
    purchaseRegister: ingested.purchaseRegister,
    accountsProcessed: ingested.accountsProcessed,
    notesToPreparer,
  });
}
