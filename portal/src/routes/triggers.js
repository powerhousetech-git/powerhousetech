const express = require('express');

const router = express.Router();

async function fireWebhook(path, body = {}) {
  const base = process.env.N8N_WEBHOOK_BASE_URL;
  if (!base) {
    const err = new Error('N8N_WEBHOOK_BASE_URL is not configured');
    err.status = 503;
    throw err;
  }
  const url = `${base.replace(/\/$/, '')}/${String(path || '').replace(/^\//, '')}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const err = new Error(`n8n returned ${res.status}`);
    err.status = 502;
    throw err;
  }
  return res.json().catch(() => ({ ok: true }));
}

/** POST /api/triggers/discover — both tracks via workflow 01 */
router.post('/discover', async (req, res) => {
  try {
    const result = await fireWebhook(process.env.N8N_DISCOVER_PATH || 'outreach-discover');
    res.json({ ok: true, message: 'Discovery triggered', n8n: result });
  } catch (err) {
    res.status(err.status || 502).json({ ok: false, error: err.message });
  }
});

/** POST /api/triggers/mail — body { track: 'A' | 'B' } via workflow 03 */
router.post('/mail', async (req, res) => {
  const { track } = req.body || {};
  if (!['A', 'B'].includes(track)) {
    return res.status(400).json({ ok: false, error: 'track must be A or B' });
  }
  try {
    const result = await fireWebhook(process.env.N8N_MAIL_PATH || 'outreach-mail', {
      track,
    });
    res.json({
      ok: true,
      message: `Mail sequence triggered for Track ${track}`,
      n8n: result,
    });
  } catch (err) {
    res.status(err.status || 502).json({ ok: false, error: err.message });
  }
});

module.exports = router;
