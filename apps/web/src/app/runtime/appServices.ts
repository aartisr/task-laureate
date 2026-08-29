import { QueryClient } from '@tanstack/react-query';
import { createFeatureRegistry } from '../../core/registry/featureRegistry';
import { createMemoryTodoRepository } from '../../infrastructure/mock/memoryRepository';
import type { TodoRepository } from '../../core/contracts/repository';
import { activityFeature } from '../../features/activity/feature';
import { listFeature } from '../../features/lists/feature';
import { searchFeature } from '../../features/search/feature';
import { settingsFeature } from '../../features/settings/feature';
import { taskFeature } from '../../features/tasks/feature';
import { collaborationFeature } from '../../features/collaboration/feature';
import { executionFeature } from '../../features/execution/feature';
import { clearBrowserWorkspace, createBufferedPersistence, createEmptyWorkspace, createIndexedDbWorkspaceAdapter, hydrateWorkspace } from '../../infrastructure/persistence/workspace';
import { createSupabaseCollaborationTodoRepository } from '../../infrastructure/persistence/supabaseCollaborationRepository';
import { authProvider, persistenceConfig } from '../../config/persistence.config';
import { setPersistenceStatus } from '../../infrastructure/persistence/status';
import { remoteSync } from '../../infrastructure/antiBacklog/mutationOutbox';
import { createTodoRemoteMutationDelivery } from '../../core/mutations/remoteMutationDelivery';
import { configureRemoteMutationQueue } from '../../core/mutations/remoteMutationQueue';
import { shouldQueueRemoteMutation } from '../../infrastructure/antiBacklog/mutationOutbox';

configureRemoteMutationQueue(remoteSync, shouldQueueRemoteMutation);

export const appServices = {
  repository: createMemoryTodoRepository(createEmptyWorkspace(), { onChange: () => undefined }) as TodoRepository,
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
    collaborationFeature,
    executionFeature,
  ]),
};

let initialization: Promise<void> | null = null;
let activeUserId: string | null = null;
let workspaceGeneration = 0;
let localWorkspaceBuffer: ReturnType<typeof createBufferedPersistence> | null = null;

function replaceRepository(repository: TodoRepository) {
  localWorkspaceBuffer?.dispose();
  localWorkspaceBuffer = null;
  appServices.queryClient.clear();
  appServices.repository = repository;
  remoteSync.setDelivery(createTodoRemoteMutationDelivery(repository));
  remoteSync.setScope(activeUserId);
}

function disposeActiveWorkspace({ clearCache = false } = {}) {
  if (clearCache) clearBrowserWorkspace();
  activeUserId = null;
  remoteSync.setScope(null);
}

function useSignedOutRepository() {
  disposeActiveWorkspace({ clearCache: true });
  // Delete the pre-account, origin-wide key from earlier versions. It must never be read or migrated.
  clearBrowserWorkspace();
  replaceRepository(createMemoryTodoRepository(createEmptyWorkspace(), { onChange: () => undefined }));
}

/**
 * Immediately removes the previous identity's in-memory and browser-cached
 * workspace. UI consumers call this at an authentication boundary, before an
 * asynchronous session lookup can leave stale Lists visible on screen.
 */
export function resetWorkspaceForAuthChange() {
  workspaceGeneration += 1;
  initialization = null;
  useSignedOutRepository();
}

/** Initializes an RLS-enforced normalized workspace before routing begins. */
export function initializePersistence(options: { force?: boolean } = {}): Promise<void> {
  if (options.force) initialization = null;
  if (initialization) return initialization;
  initialization = (async () => {
    const generation = workspaceGeneration;
    const isCurrentGeneration = () => generation === workspaceGeneration;
    if (persistenceConfig.driver !== 'supabase') {
      const adapter = createIndexedDbWorkspaceAdapter(persistenceConfig.local.storageKey);
      const workspace = await hydrateWorkspace(adapter, createEmptyWorkspace());
      if (!isCurrentGeneration()) return;
      const buffer = createBufferedPersistence(adapter, {
        onSaveError: () => setPersistenceStatus('error', 'Local changes are waiting to be saved in this browser.'),
        onSaveSuccess: () => setPersistenceStatus('local', 'Saving to this browser only.'),
      });
      replaceRepository(createMemoryTodoRepository(workspace, { onChange: (next) => buffer.schedule(next) }));
      localWorkspaceBuffer = buffer;
      setPersistenceStatus('local', 'Saving to this browser only.');
      return;
    }
    setPersistenceStatus('connecting', 'Connecting to Supabase…');
    let session: Awaited<ReturnType<typeof authProvider.getSession>> = null;
    try {
      session = await authProvider.getSession();
      if (!isCurrentGeneration()) return;
      if (!session) {
        useSignedOutRepository();
        setPersistenceStatus('local', 'Sign in to access a private workspace.');
        console.info('[Task-Laureate persistence] No authenticated Supabase session; using an empty in-memory workspace.');
        return;
      }
      disposeActiveWorkspace({ clearCache: true });
      clearBrowserWorkspace();
      activeUserId = session.user.id;
      replaceRepository(createSupabaseCollaborationTodoRepository(persistenceConfig.supabase));
      setPersistenceStatus('synced', 'Connected to Supabase. Tasks are secured per List and Task.');
    } catch (error) {
      if (!isCurrentGeneration()) return;
      if (!persistenceConfig.supabase.fallbackToLocal) throw error;
      const message = error instanceof Error ? error.message : String(error);
      console.error('[Task-Laureate persistence] Supabase initialization failed.', { message, error });
      if (session) {
        disposeActiveWorkspace({ clearCache: true });
        clearBrowserWorkspace();
        activeUserId = session.user.id;
        replaceRepository(createMemoryTodoRepository(createEmptyWorkspace(), { onChange: () => undefined }));
      } else {
        useSignedOutRepository();
      }
      setPersistenceStatus('error', `Supabase is not connected. ${session ? 'Your workspace could not be loaded.' : 'Sign in to access a workspace.'} ${message}`);
    }
  })();
  return initialization;
}
