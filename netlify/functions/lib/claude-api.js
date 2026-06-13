const systemPrompt = require('./tally-system-prompt');

const MAX_TALLY_CHARS = 80000;

async function mapTallyWithClaude({ entityName, fyEnd, prevFyEnd, tallyData, apiKey }) {
  const trimmed = String(tallyData || '').slice(0, MAX_TALLY_CHARS);
  if (!trimmed.trim()) {
    throw new Error('tallyData is required');
  }

  const userMessage = `Entity: ${entityName}\nFinancial year end: ${fyEnd}\nPrevious year end: ${prevFyEnd}\n\nTALLY EXPORT DATA:\n${trimmed}`;

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
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  const anthropicBody = await anthropicResp.json().catch(() => ({}));

  if (!anthropicResp.ok) {
    throw new Error(`Mapping service error (HTTP ${anthropicResp.status})`);
  }

  const rawText = anthropicBody.content?.find((b) => b.type === 'text')?.text || '';
  const clean = rawText.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();

  try {
    return JSON.parse(clean);
  } catch {
    throw new Error('Invalid mapping response from service');
  }
}

module.exports = { mapTallyWithClaude, MAX_TALLY_CHARS };
