import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Resolve posthog-js to the real package when installed, or a no-op stub
// when it is not yet present (local dev without npm install, offline CI).
// This keeps the build unconditionally green without posthog-js in node_modules.
const posthogResolved = existsSync(resolve(__dirname, 'node_modules/posthog-js'))
  ? 'posthog-js'
  : resolve(__dirname, 'src/infrastructure/analytics/posthogStub.ts');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'posthog-js': posthogResolved,
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          supabase: ['@supabase/supabase-js'],
          // posthog-js gets its own cacheable chunk when installed
          ...(posthogResolved === 'posthog-js' ? { posthog: ['posthog-js'] } : {}),
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
