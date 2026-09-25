import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Standalone dashboard app. Runs fully client-side; no backend server.
// For production it is published under the /outreach-dashboard/ route on the
// static site, so assets must be served from that base path. In dev we keep the
// base at "/" for a clean local URL.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/outreach-dashboard/' : '/',
  server: {
    port: 5180,
  },
  build: {
    // Publish built assets into a committed, Netlify-served folder at repo root
    // (kept separate from this source folder, mirroring the medspa dashboard).
    outDir: '../outreach-dashboard',
    emptyOutDir: true,
  },
}));
