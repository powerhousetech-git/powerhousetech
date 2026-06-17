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
  'book-build-start': {
    entrypoint_path: 'index.ts',
    verify_jwt: false,
    files: [
      { name: 'index.ts', content: read('book-build-start/index.ts') },
      { name: '../_shared/book-build-api.ts', content: read('_shared/book-build-api.ts') },
      { name: '../_shared/book-classify-prompt.ts', content: read('_shared/book-classify-prompt.ts') },
      { name: '../_shared/reconcile-books.ts', content: read('_shared/reconcile-books.ts') },
      { name: '../_shared/pack-ingest.ts', content: read('_shared/pack-ingest.ts') },
      { name: '../_shared/bank-statement.ts', content: read('_shared/bank-statement.ts') },
      { name: '../_shared/cash-book.ts', content: read('_shared/cash-book.ts') },
      { name: '../_shared/register.ts', content: read('_shared/register.ts') },
      { name: '../_shared/opening-tb.ts', content: read('_shared/opening-tb.ts') },
      { name: '../_shared/coa.ts', content: read('_shared/coa.ts') },
      { name: '../_shared/cors.ts', content: read('_shared/cors.ts') },
      { name: '../_shared/job-store.ts', content: read('_shared/job-store.ts') },
    ],
  },
  'book-build-status': {
    entrypoint_path: 'index.ts',
    verify_jwt: false,
    files: [
      { name: 'index.ts', content: read('book-build-status/index.ts') },
      { name: '../_shared/cors.ts', content: read('_shared/cors.ts') },
      { name: '../_shared/job-store.ts', content: read('_shared/job-store.ts') },
    ],
  },
};

const outDir = path.join(root, '.edge-deploy');
fs.mkdirSync(outDir, { recursive: true });

for (const [name, bundle] of Object.entries(bundles)) {
  fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify(bundle));
  console.log(`${name}: ${bundle.files.length} files`);
}
