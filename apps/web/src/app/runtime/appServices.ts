import { QueryClient } from '@tanstack/react-query';
import { createFeatureRegistry } from '../../core/registry/featureRegistry';
import { createMemoryTodoRepository } from '../../infrastructure/mock/memoryRepository';
import { activityFeature } from '../../features/activity/feature';
import { listFeature } from '../../features/lists/feature';
import { searchFeature } from '../../features/search/feature';
import { settingsFeature } from '../../features/settings/feature';
import { taskFeature } from '../../features/tasks/feature';
import { browserWorkspaceKeyForUser, clearBrowserWorkspace, createBufferedPersistence, createEmptyWorkspace, loadBrowserWorkspace, saveBrowserWorkspace, type WorkspaceData } from '../../infrastructure/persistence/workspace';
import { createSupabaseWorkspaceAdapter } from '../../infrastructure/persistence/supabase';
import { authProvider, persistenceConfig } from '../../config/persistence.config';
import { setPersistenceStatus } from '../../infrastructure/persistence/status';

export const appServices = {
  repository: createMemoryTodoRepository(createEmptyWorkspace(), { onChange: () => undefined }),
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
let activeUserId: string | null = null;
let pagehideListenerRegistered = false;

function replaceRepository(workspace: WorkspaceData, onChange: (data: WorkspaceData) => void) {
  appServices.queryClient.clear();
  appServices.repository = createMemoryTodoRepository(workspace, { onChange });
}

function disposeActiveWorkspace({ clearCache = false } = {}) {
  activeBuffer?.dispose();
  activeBuffer = null;
  if (clearCache && activeUserId) clearBrowserWorkspace(browserWorkspaceKeyForUser(activeUserId));
  activeUserId = null;
}

function useSignedOutRepository() {
  disposeActiveWorkspace({ clearCache: true });
  // Delete the pre-account, origin-wide key from earlier versions. It must never be read or migrated.
  clearBrowserWorkspace();
  replaceRepository(createEmptyWorkspace(), () => undefined);
}

function hasWorkspaceContent(workspace: WorkspaceData) {
  return workspace.lists.length > 0 || workspace.tasks.length > 0 || workspace.activity.length > 0 || workspace.templates.length > 0;
}

/** Initializes a private, authenticated workspace before routing begins. */
export function initializePersistence(options: { force?: boolean } = {}): Promise<void> {
  if (options.force) initialization = null;
  if (initialization) return initialization;
  initialization = (async () => {
    if (persistenceConfig.driver !== 'supabase') {
      setPersistenceStatus('local', 'Saving to this browser only.');
      return;
    }
    setPersistenceStatus('connecting', 'Connecting to Supabase…');
    let session: Awaited<ReturnType<typeof authProvider.getSession>> = null;
    try {
      session = await authProvider.getSession();
      if (!session) {
        useSignedOutRepository();
        setPersistenceStatus('local', 'Sign in to access a private workspace.');
        console.info('[Task-Laureate persistence] No authenticated Supabase session; using an empty in-memory workspace.');
        return;
      }
      disposeActiveWorkspace({ clearCache: activeUserId !== null && activeUserId !== session.user.id });
      clearBrowserWorkspace();
      activeUserId = session.user.id;
      const localKey = browserWorkspaceKeyForUser(session.user.id);
      const workspaceId = `${persistenceConfig.supabase.workspaceId}_${session.user.id}`;
      const adapter = createSupabaseWorkspaceAdapter({ ...persistenceConfig.supabase, workspaceId });
      const fallbackWorkspace = loadBrowserWorkspace(createEmptyWorkspace(), localKey);
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
      // The offline mirror is namespaced to this authenticated user and never crosses an account boundary.
      saveBrowserWorkspace(workspace, localKey);
      activeBuffer = buffered;
      replaceRepository(workspace, (data) => { saveBrowserWorkspace(data, localKey); buffered.schedule(data); });
      if (!remoteWorkspace && hasWorkspaceContent(workspace)) {
        console.info('[Task-Laureate persistence] Restoring this signed-in user’s private offline workspace.', { workspaceId });
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
      console.error('[Task-Laureate persistence] Supabase initialization failed.', { message, error });
      if (session) {
        disposeActiveWorkspace({ clearCache: activeUserId !== null && activeUserId !== session.user.id });
        clearBrowserWorkspace();
        activeUserId = session.user.id;
        const localKey = browserWorkspaceKeyForUser(session.user.id);
        replaceRepository(loadBrowserWorkspace(createEmptyWorkspace(), localKey), (data) => saveBrowserWorkspace(data, localKey));
      } else {
        useSignedOutRepository();
      }
      setPersistenceStatus('error', `Supabase is not connected. ${session ? 'Only this signed-in user’s offline copy is available.' : 'Sign in to access a private workspace.'} ${message}`);
    }
  })();
  return initialization;
}
