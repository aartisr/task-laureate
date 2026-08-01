import { QueryClient } from '@tanstack/react-query';
import { createFeatureRegistry } from '../../core/registry/featureRegistry';
import { createMemoryTodoRepository } from '../../infrastructure/mock/memoryRepository';
import { activityFeature } from '../../features/activity/feature';
import { listFeature } from '../../features/lists/feature';
import { searchFeature } from '../../features/search/feature';
import { settingsFeature } from '../../features/settings/feature';
import { taskFeature } from '../../features/tasks/feature';
import { seedData } from '../../infrastructure/mock/seed';
import { loadBrowserWorkspace, saveBrowserWorkspace } from '../../infrastructure/persistence/workspace';
import { createBufferedPersistence } from '../../infrastructure/persistence/workspace';
import { createSupabaseWorkspaceAdapter } from '../../infrastructure/persistence/supabase';
import { authProvider, persistenceConfig } from '../../config/persistence.config';
import { setPersistenceStatus } from '../../infrastructure/persistence/status';

export const appServices = {
  repository: createMemoryTodoRepository(loadBrowserWorkspace(seedData), { onChange: saveBrowserWorkspace }),
  queryClient: new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  }),
  registry: createFeatureRegistry([
    listFeature,
    taskFeature,
    searchFeature,
    activityFeature,
    settingsFeature,
  ]),
};

let initialization: Promise<void> | null = null;
let activeBuffer: ReturnType<typeof createBufferedPersistence> | null = null;
let pagehideListenerRegistered = false;

function replaceRepository(workspace: ReturnType<typeof loadBrowserWorkspace>, onChange: (data: ReturnType<typeof loadBrowserWorkspace>) => void) {
  appServices.queryClient.clear();
  appServices.repository = createMemoryTodoRepository(workspace, { onChange });
}

function useLocalRepository() {
  activeBuffer = null;
  replaceRepository(loadBrowserWorkspace(seedData), saveBrowserWorkspace);
}

/** Initializes the configured remote store before routing begins. Local storage remains the safe fallback. */
export function initializePersistence(options: { force?: boolean } = {}): Promise<void> {
  if (options.force) initialization = null;
  if (initialization) return initialization;
  initialization = (async () => {
    if (persistenceConfig.driver !== 'supabase') {
      setPersistenceStatus('local', 'Saving to this browser only.');
      return;
    }
    setPersistenceStatus('connecting', 'Connecting to Supabase…');
    try {
      const session = await authProvider.getSession();
      if (!session) {
        useLocalRepository();
        setPersistenceStatus('local', 'Saving to this browser only. Sign in from Settings to enable private cloud sync.');
        console.info('[Task-Laureate persistence] No authenticated Supabase session; using local browser storage.');
        return;
      }
      const workspaceId = `${persistenceConfig.supabase.workspaceId}_${session.user.id}`;
      const adapter = createSupabaseWorkspaceAdapter({ ...persistenceConfig.supabase, workspaceId });
      const fallbackWorkspace = loadBrowserWorkspace(seedData);
      const remoteWorkspace = await adapter.load();
      const workspace = remoteWorkspace?.data ?? fallbackWorkspace;
      const buffered = createBufferedPersistence(adapter, {
        debounceMs: persistenceConfig.supabase.debounceMs,
        onSaveStart: () => setPersistenceStatus('saving', 'Saving changes to Supabase…'),
        onSaveSuccess: () => setPersistenceStatus('synced', 'All changes are saved to Supabase.'),
        onSaveError: (error, attempt) => {
          const message = error instanceof Error ? error.message : String(error);
          console.error('[Task-Laureate persistence] Save failed; retaining local data and retrying.', { attempt, message });
          setPersistenceStatus('error', `Supabase save failed; retrying automatically. ${message}`);
        },
      });
      // Keep a local mirror: it is the offline/read-failure fallback and never replaces the remote source of truth while online.
      saveBrowserWorkspace(workspace);
      activeBuffer = buffered;
      replaceRepository(workspace, (data) => { saveBrowserWorkspace(data); buffered.schedule(data); });
      if (!remoteWorkspace) {
        console.info('[Task-Laureate persistence] No remote workspace exists; uploading the local workspace.', { workspaceId });
        buffered.schedule(workspace);
        await buffered.flush();
      }
      setPersistenceStatus('synced', 'Connected to Supabase. All changes are saved automatically.');
      if (!pagehideListenerRegistered) {
        pagehideListenerRegistered = true;
        window.addEventListener('pagehide', () => {
          void activeBuffer?.flush().catch((error) => console.error('[Task-Laureate persistence] Final page-exit save failed.', error));
        });
      }
    } catch (error) {
      if (!persistenceConfig.supabase.fallbackToLocal) throw error;
      const message = error instanceof Error ? error.message : String(error);
      console.error('[Task-Laureate persistence] Supabase initialization failed; using local browser storage.', { message, error });
      setPersistenceStatus('error', `Supabase is not connected. Changes are saved only in this browser. ${message}`);
    }
  })();
  return initialization;
}
