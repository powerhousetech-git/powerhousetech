import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Standalone dashboard app. Runs fully client-side; no backend server.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
  },
});
