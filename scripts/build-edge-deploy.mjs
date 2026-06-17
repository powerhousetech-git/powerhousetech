#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const fnRoot = path.join(root, 'supabase/functions');

function read(rel) {
  return fs.readFileSync(path.join(fnRoot, rel), 'utf8');
}

const bundles = {
  'user-credits': {
    entrypoint_path: 'index.ts',
    verify_jwt: false,
    files: [
      { name: 'index.ts', content: read('user-credits/index.ts') },
      { name: '../_shared/firebase-auth.ts', content: read('_shared/firebase-auth.ts') },
      { name: '../_shared/user-credits.ts', content: read('_shared/user-credits.ts') },
      { name: '../_shared/cors.ts', content: read('_shared/cors.ts') },
    ],
  },
  'tally-map-status': {
    entrypoint_path: 'index.ts',
    verify_jwt: false,
    files: [
      { name: 'index.ts', content: read('tally-map-status/index.ts') },
      { name: '../_shared/cors.ts', content: read('_shared/cors.ts') },
      { name: '../_shared/job-store.ts', content: read('_shared/job-store.ts') },
    ],
  },
  'tally-map-start': {
    entrypoint_path: 'index.ts',
    verify_jwt: false,
    files: [
      { name: 'index.ts', content: read('tally-map-start/index.ts') },
      { name: '../_shared/claude-api.ts', content: read('_shared/claude-api.ts') },
      { name: '../_shared/cors.ts', content: read('_shared/cors.ts') },
      { name: '../_shared/job-store.ts', content: read('_shared/job-store.ts') },
      { name: '../_shared/reconcile-mapping.ts', content: read('_shared/reconcile-mapping.ts') },
      { name: '../_shared/trading-account.ts', content: read('_shared/trading-account.ts') },
      { name: '../_shared/balance-sheet.ts', content: read('_shared/balance-sheet.ts') },
      { name: '../_shared/tally-system-prompt.ts', content: read('_shared/tally-system-prompt.ts') },
    ],
  },
};

const outDir = path.join(root, '.edge-deploy');
fs.mkdirSync(outDir, { recursive: true });

for (const [name, bundle] of Object.entries(bundles)) {
  fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify(bundle));
  console.log(`${name}: ${bundle.files.length} files`);
}
