import type { ActivityEvent, ListTemplate, TodoItem, TodoList } from '../../core/contracts/domain';

/** Stable, vendor-neutral interchange contract. Database adapters store this exact value. */
export interface WorkspaceData {
  lists: TodoList[];
  tasks: TodoItem[];
  activity: ActivityEvent[];
  templates: ListTemplate[];
}

export interface WorkspaceExport {
  format: 'task-laureate/workspace';
  version: 1;
  exportedAt: string;
  data: WorkspaceData;
}

export function createEmptyWorkspace(): WorkspaceData {
  return { lists: [], tasks: [], activity: [], templates: [] };
}

/** Implement this tiny interface for Postgres, SQLite, IndexedDB, S3, an API, or any other store. */
export interface WorkspacePersistenceAdapter {
  load(): Promise<WorkspaceExport | null>;
  save(workspace: WorkspaceExport): Promise<void>;
  clear?(): Promise<void>;
}

/**
 * Startup helper for remote or asynchronous stores. A server adapter can load
 * from any database, while `persistWorkspace` is used as the repository's
 * on-change callback. This keeps storage policy outside domain operations.
 */
export async function hydrateWorkspace(adapter: WorkspacePersistenceAdapter, fallback: WorkspaceData): Promise<WorkspaceData> {
  return (await adapter.load())?.data ?? clone(fallback);
}

export function persistWorkspace(adapter: WorkspacePersistenceAdapter) {
  return (data: WorkspaceData) => { void adapter.save(createWorkspaceExport(data)); };
}

/** Lossless write-behind queue: bursts are coalesced, writes stay ordered, and the newest snapshot always wins. */
export function createBufferedPersistence(adapter: WorkspacePersistenceAdapter, options: {
  debounceMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  onSaveStart?: () => void;
  onSaveSuccess?: () => void;
  onSaveError?: (error: unknown, attempt: number) => void;
} = {}) {
  const debounceMs = options.debounceMs ?? 250;
  const maxRetries = options.maxRetries ?? 3;
  const retryDelayMs = options.retryDelayMs ?? 5_000;
  let latest: WorkspaceExport | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let flushing: Promise<void> | null = null;
  let disposed = false;

  const reportError = (error: unknown, attempt: number) => {
    options.onSaveError?.(error, attempt);
  };

  const scheduleFlush = (delay: number) => {
    if (disposed) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      // flush reports the error itself and schedules the next retry. Swallow
      // here to avoid an unhandled rejection from a timer callback.
      void flush().catch(() => undefined);
    }, delay);
  };

  const saveWithRetry = async (workspace: WorkspaceExport) => {
    let attempt = 0;
    while (true) {
      try {
        await adapter.save(workspace);
        return;
      }
      catch (error) {
        attempt++;
        if (attempt > maxRetries) throw error;
        await new Promise((resolve) => setTimeout(resolve, Math.min(1_000, 100 * 2 ** (attempt - 1))));
      }
    }
  };
  const flush = async () => {
    if (disposed) return;
    if (timer) clearTimeout(timer);
    timer = undefined;
    if (flushing) return flushing;
    flushing = (async () => {
      while (latest && !disposed) {
        const next = latest;
        latest = null;
        options.onSaveStart?.();
        try {
          await saveWithRetry(next);
          options.onSaveSuccess?.();
        } catch (error) {
          // Keep the most recent snapshot in memory. A later mutation may have
          // already replaced it, which is preferable to sending stale data.
          latest ??= next;
          reportError(error, maxRetries + 1);
          scheduleFlush(retryDelayMs);
          throw error;
        }
      }
    })();
    try { await flushing; } finally { flushing = null; }
  };
  return {
    schedule(data: WorkspaceData) {
      if (disposed) return;
      latest = createWorkspaceExport(data);
      scheduleFlush(debounceMs);
    },
    flush,
    dispose() {
      disposed = true;
      if (timer) clearTimeout(timer);
      timer = undefined;
      latest = null;
    },
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isWorkspaceData(value: unknown): value is WorkspaceData {
  if (!isRecord(value)) return false;
  return ['lists', 'tasks', 'activity', 'templates'].every((key) => Array.isArray(value[key]));
}

export function createWorkspaceExport(data: WorkspaceData): WorkspaceExport {
  return { format: 'task-laureate/workspace', version: 1, exportedAt: new Date().toISOString(), data: clone(data) };
}

/** Parses only the documented format and puts strict practical bounds on imports. */
export function parseWorkspaceExport(serialized: string | unknown): WorkspaceExport {
  const value: unknown = typeof serialized === 'string' ? JSON.parse(serialized) : serialized;
  if (!isRecord(value) || value.format !== 'task-laureate/workspace' || value.version !== 1 || !isWorkspaceData(value.data)) {
    throw new Error('This is not a supported Task-Laureate workspace export.');
  }
  const { lists, tasks, activity, templates } = value.data;
  if (lists.length > 10_000 || tasks.length > 100_000 || activity.length > 500_000 || templates.length > 10_000) {
    throw new Error('The workspace exceeds the safe import limit.');
  }
  return createWorkspaceExport({ lists, tasks, activity, templates });
}

export const LEGACY_BROWSER_WORKSPACE_KEY = 'task-laureate.workspace.v1';

export function browserWorkspaceKeyForUser(userId: string) {
  if (!userId) throw new Error('A user ID is required for browser workspace storage.');
  return `${LEGACY_BROWSER_WORKSPACE_KEY}.${encodeURIComponent(userId)}`;
}

export function loadBrowserWorkspace(fallback: WorkspaceData, key = LEGACY_BROWSER_WORKSPACE_KEY): WorkspaceData {
  if (typeof window === 'undefined') return clone(fallback);
  try {
    const serialized = window.localStorage.getItem(key);
    return serialized ? parseWorkspaceExport(serialized).data : clone(fallback);
  } catch {
    return clone(fallback);
  }
}

export function saveBrowserWorkspace(data: WorkspaceData, key = LEGACY_BROWSER_WORKSPACE_KEY) {
  if (typeof window !== 'undefined') window.localStorage.setItem(key, JSON.stringify(createWorkspaceExport(data)));
}

export function clearBrowserWorkspace(key = LEGACY_BROWSER_WORKSPACE_KEY) {
  if (typeof window !== 'undefined') window.localStorage.removeItem(key);
}

export function createLocalStorageAdapter(key = LEGACY_BROWSER_WORKSPACE_KEY): WorkspacePersistenceAdapter {
  return {
    async load() {
      if (typeof window === 'undefined') return null;
      const value = window.localStorage.getItem(key);
      return value ? parseWorkspaceExport(value) : null;
    },
    async save(workspace) {
      if (typeof window !== 'undefined') window.localStorage.setItem(key, JSON.stringify(workspace));
    },
    async clear() {
      if (typeof window !== 'undefined') window.localStorage.removeItem(key);
    },
  };
}
