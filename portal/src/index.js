require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const { requireAuth } = require('./middleware/auth');
const { errorHandler } = require('./middleware/errorHandler');
const contactsRouter = require('./routes/contacts');
const statsRouter = require('./routes/stats');
const triggersRouter = require('./routes/triggers');
const configRouter = require('./routes/config');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Health (no auth) — for uptime checks only
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'outreach-portal' });
});

// All other API routes require n8n API key OR Firebase admin
app.use('/api', requireAuth);
app.use('/api/contacts', contactsRouter);
app.use('/api/stats', statsRouter);
app.use('/api/triggers', triggersRouter);
app.use('/api/config', configRouter);

// Dashboard static files (shell HTML; API still gated)
app.use(express.static(path.join(__dirname, '..', 'public'), {
  extensions: ['html'],
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    }
  },
}));

app.get('/contacts/:id', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'contact.html'));
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Outreach portal listening on http://localhost:${PORT}`);
  console.log('API: contacts, stats, config, triggers (discover / mail)');
  console.log('Auth: Bearer PORTAL_API_KEY (n8n) or Firebase admin ID token (dashboard)');
});
