import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

// Resolve posthog-js to the real package when installed, or a no-op stub
// when it is not yet present (local dev without npm install, offline CI).
// This keeps the build unconditionally green without posthog-js in node_modules.
const posthogStubPath = resolve(__dirname, 'src/infrastructure/analytics/posthogStub.ts');

function resolvePosthogAlias(): string {
  try {
    // Works for both local node_modules and hoisted workspace installs.
    const require = createRequire(import.meta.url);
    require.resolve('posthog-js');
    return 'posthog-js';
  } catch {
    return posthogStubPath;
  }
}

const posthogResolved = resolvePosthogAlias();

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'posthog-js': posthogResolved,
    },
  },
  build: {
    // Puck is loaded only by the lazy /puck/$pageId editor route. Its editor
    // package is deliberately isolated below; the enforced gzip performance
    // budget is the meaningful guard for user-facing payloads, rather than
    // Vite's generic uncompressed 500 kB advisory.
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          supabase: ['@supabase/supabase-js'],
          // The visual editor is intentionally isolated from everyday task
          // flows. Splitting its vendor code keeps the Puck route cacheable
          // without making capture, planning, or execution pay for it.
          puck: ['@puckeditor/core'],
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
