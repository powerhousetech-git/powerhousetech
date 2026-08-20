#!/usr/bin/env node
/**
 * Patch n8n outreach workflow JSONs for the PowerhouseTech portal.
 *
 * Usage:
 *   node n8n/patch-portal-auth.js              # ensure Authorization header placeholders
 *   PORTAL_BASE_URL=http://localhost:3000 \
 *   PORTAL_API_KEY=secret \
 *   node n8n/patch-portal-auth.js --apply      # also replace REPLACE_* values
 *
 * Expects files in n8n/:
 *   01_lead_discovery.json
 *   02_email_resolver.json
 *   03_sequence_engine.json
 *   04_reply_monitor.json
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const FILES = [
  '01_lead_discovery.json',
  '02_email_resolver.json',
  '03_sequence_engine.json',
  '04_reply_monitor.json',
];

const APPLY = process.argv.includes('--apply');
const BASE = process.env.PORTAL_BASE_URL || '';
const KEY = process.env.PORTAL_API_KEY || '';

const AUTH_NAME = 'Authorization';
const AUTH_VALUE = 'Bearer REPLACE_PORTAL_API_KEY';

function isPortalUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return (
    url.includes('REPLACE_PORTAL_BASE_URL') ||
    url.includes('/api/contacts') ||
    url.includes('/api/stats') ||
    (BASE && url.startsWith(BASE))
  );
}

function ensureHeader(parameters) {
  if (!parameters || typeof parameters !== 'object') return { changed: false };
  let changed = false;

  // n8n HTTP Request node shapes vary by version
  if (Array.isArray(parameters.headerParameters?.parameters)) {
    const list = parameters.headerParameters.parameters;
    const idx = list.findIndex(
      (h) => String(h.name || '').toLowerCase() === 'authorization',
    );
    if (idx === -1) {
      list.push({ name: AUTH_NAME, value: AUTH_VALUE });
      changed = true;
    } else if (!String(list[idx].value || '').includes('Bearer')) {
      list[idx].value = AUTH_VALUE;
      changed = true;
    }
  } else if (parameters.headerParametersUi?.parameter) {
    const list = parameters.headerParametersUi.parameter;
    if (!Array.isArray(list)) return { changed: false };
    const idx = list.findIndex(
      (h) => String(h.name || '').toLowerCase() === 'authorization',
    );
    if (idx === -1) {
      list.push({ name: AUTH_NAME, value: AUTH_VALUE });
      changed = true;
    } else if (!String(list[idx].value || '').includes('Bearer')) {
      list[idx].value = AUTH_VALUE;
      changed = true;
    }
  } else {
    // Create modern headerParameters block
    parameters.headerParameters = {
      parameters: [{ name: AUTH_NAME, value: AUTH_VALUE }],
    };
    changed = true;
  }

  return { changed };
}

function walkNodes(nodes) {
  let changed = 0;
  let portalNodes = 0;
  for (const node of nodes || []) {
    const type = String(node.type || '');
    if (!type.toLowerCase().includes('httprequest')) continue;
    const url =
      node.parameters?.url ||
      node.parameters?.requestMethod ||
      node.parameters?.endpoint ||
      '';
    const urlStr = typeof url === 'string' ? url : JSON.stringify(node.parameters || {});
    if (!isPortalUrl(urlStr) && !isPortalUrl(JSON.stringify(node.parameters || {}))) {
      continue;
    }
    portalNodes += 1;
    const result = ensureHeader(node.parameters);
    if (result.changed) changed += 1;
  }
  return { changed, portalNodes };
}

function applyPlaceholders(raw) {
  let out = raw;
  if (BASE) {
    out = out.split('REPLACE_PORTAL_BASE_URL').join(BASE.replace(/\/$/, ''));
  }
  if (KEY) {
    out = out.split('REPLACE_PORTAL_API_KEY').join(KEY);
  }
  return out;
}

function main() {
  let anyMissing = false;
  for (const file of FILES) {
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full)) {
      console.warn(`SKIP (missing): ${file}`);
      anyMissing = true;
      continue;
    }

    let raw = fs.readFileSync(full, 'utf8');
    let data;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      console.error(`FAIL parse ${file}:`, err.message);
      process.exitCode = 1;
      continue;
    }

    const nodes = data.nodes || data;
    const { changed, portalNodes } = walkNodes(Array.isArray(nodes) ? nodes : data.nodes);

    let next = JSON.stringify(data, null, 2) + '\n';
    if (APPLY) {
      if (!BASE || !KEY) {
        console.error('--apply requires PORTAL_BASE_URL and PORTAL_API_KEY env vars');
        process.exit(1);
      }
      next = applyPlaceholders(next);
      // Keep JSON valid after string replace
      next = JSON.stringify(JSON.parse(next), null, 2) + '\n';
    }

    fs.writeFileSync(full, next);
    console.log(
      `${file}: portal HTTP nodes=${portalNodes}, auth headers added/fixed=${changed}` +
        (APPLY ? ', placeholders applied' : ''),
    );
  }

  if (anyMissing) {
    console.log('\nDrop the 4 workflow JSON files into n8n/ then re-run this script.');
    console.log('See n8n/COWORK_HANDOFF.md');
  }
}

main();
