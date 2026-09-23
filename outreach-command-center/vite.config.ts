import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Outreach Command Center — fully client-side (no app backend).
// Published under /command-center/ on the static site in production.
// In dev we proxy n8n API calls through /n8n-api to avoid browser CORS issues.
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, '.', '');
  const n8nBase =
    env.VITE_N8N_BASE_URL?.trim() || 'https://shreyas-sinha.app.n8n.cloud';

  return {
    plugins: [react()],
    base: command === 'build' ? '/command-center/' : '/',
    server: {
      port: 5181,
      proxy: {
        // Dev-only proxy: /n8n-api/* -> {n8nBase}/api/v1/*
        '/n8n-api': {
          target: n8nBase,
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/n8n-api/, '/api/v1'),
        },
      },
    },
    build: {
      // Publish built assets into a committed, Netlify-served folder at repo root.
      outDir: '../command-center',
      emptyOutDir: true,
    },
  };
});
