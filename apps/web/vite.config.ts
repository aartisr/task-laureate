import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve posthog-js to the real package when installed, or a no-op stub
// when it is not yet present (local dev without npm install, offline CI).
// This keeps the build unconditionally green without posthog-js in node_modules.
const appDirectory = fileURLToPath(new URL('.', import.meta.url));
const posthogStubPath = resolve(appDirectory, 'src/infrastructure/analytics/posthogStub.ts');

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

/**
 * Keep cross-route vendors out of the everyday task flows. A function is used
 * instead of Rollup's object shorthand because Vite 8's Rolldown pipeline
 * supports only the function form, while Vite 5–7 support both. Puck remains
 * split by its lazy route; forcing all of its dependency graph into one named
 * manual chunk regresses its payload budget.
 */
function manualChunks(moduleId: string) {
  if (moduleId.includes('/node_modules/@supabase/')) return 'supabase';
  if (posthogResolved === 'posthog-js' && moduleId.includes('/node_modules/posthog-js/')) return 'posthog';
  // Keep the entry small and cacheable: the application shell changes more
  // often than React and TanStack's routing/query runtimes.
  if (moduleId.includes('/node_modules/react/') || moduleId.includes('/node_modules/react-dom/')) return 'react-runtime';
  if (moduleId.includes('/node_modules/@tanstack/')) return 'tanstack-runtime';
  return undefined;
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'posthog-js': posthogResolved,
    },
  },
  build: {
    // Puck is loaded only by the lazy /puck/$pageId editor route. The enforced
    // gzip performance budget is the meaningful guard for user-facing payloads,
    // rather than Vite's generic uncompressed 500 kB advisory.
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
