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

const STORAGE_KEY = 'task-laureate.workspace.v1';

export function loadBrowserWorkspace(fallback: WorkspaceData): WorkspaceData {
  if (typeof window === 'undefined') return clone(fallback);
  try {
    const serialized = window.localStorage.getItem(STORAGE_KEY);
    return serialized ? parseWorkspaceExport(serialized).data : clone(fallback);
  } catch {
    return clone(fallback);
  }
}

export function saveBrowserWorkspace(data: WorkspaceData) {
  if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, JSON.stringify(createWorkspaceExport(data)));
}

export function createLocalStorageAdapter(key = STORAGE_KEY): WorkspacePersistenceAdapter {
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
