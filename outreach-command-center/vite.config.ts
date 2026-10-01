import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Outreach Command Center — client app. All Google/n8n calls go through the
// serverless functions in /api (see api/*.ts), so no proxy config is needed.
//
// Two build targets:
//  - Vercel (primary): default base "/" and outDir "dist".
//  - Netlify sample preview: BASE_PATH=/command-center/ OUT_DIR=../command-center
//    with VITE_USE_MOCK_DATA=true (see scripts/build-outreach-command-center.sh).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react()],
    base: env.BASE_PATH || '/',
    server: { port: 5181 },
    build: {
      outDir: env.OUT_DIR || 'dist',
      emptyOutDir: true,
    },
  };
});
