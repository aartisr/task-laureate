import type { ActivityEvent, DashboardSummary, ListTemplate, SearchResult, TodoItem, TodoList } from '../../core/contracts/domain';
import type { CursorPage, CursorPageInput, ListPageInput, TodoListInput, TodoListUpdateInput, TodoRepository, TodoTaskInput, TodoTaskUpdateInput } from '../../core/contracts/repository';
import { createSupabaseCollaborationGateway } from './collaborationGateway';
import type { SupabasePersistenceConfig } from './config';
import { collaborationError } from './collaborationErrors';

type FetchLike = typeof fetch;
type ListRow = { id: string; title: string; description: string; status: TodoList['status']; created_at: string; updated_at: string; deleted_at: string | null };
type TaskRow = { id: string; list_id: string; title: string; note_document: string; status: TodoItem['status']; priority: TodoItem['priority']; due_date: string | null; tags: string[]; order_key: number; created_at: string; updated_at: string; completed_at: string | null; deleted_at: string | null };
type WorkspaceRow = { id: string; owner_id: string };
const REQUEST_TIMEOUT_MS = 15_000;

function listFromRow(row: ListRow, tasks: TaskRow[]): TodoList {
  const ownTasks = tasks.filter((task) => task.list_id === row.id && task.status !== 'deleted');
  const completed = ownTasks.filter((task) => task.status === 'done').length;
  return { id: row.id, title: row.title, description: row.description, status: row.status, templateId: null, createdAt: row.created_at, updatedAt: row.updated_at, archivedAt: row.status === 'archived' ? row.updated_at : null, completedAt: row.status === 'completed' ? row.updated_at : null, deletedAt: row.deleted_at, taskCount: ownTasks.length, completedTaskCount: completed, completionPercent: ownTasks.length ? Math.round(completed / ownTasks.length * 100) : 0 };
}
function taskFromRow(row: TaskRow): TodoItem { return { id: row.id, listId: row.list_id, title: row.title, notes: row.note_document, status: row.status, priority: row.priority, dueDate: row.due_date, tags: row.tags ?? [], order: Number(row.order_key), createdAt: row.created_at, updatedAt: row.updated_at, completedAt: row.completed_at, deletedAt: row.deleted_at }; }
function first<T>(rows: T[]): T { if (!rows[0]) throw new Error('The requested resource was not returned. It may have changed or you may no longer have access.'); return rows[0]; }
function rpcRecord<T>(value: T | T[]): T { return Array.isArray(value) ? first(value) : value; }

/**
 * Normalized, RLS-enforced persistence. All resource authorization stays in
 * Postgres; this adapter only maps the public domain contract to Data API calls.
 * It is composed with the collaboration gateway rather than duplicating invite code.
 */
export function createSupabaseCollaborationTodoRepository(config: SupabasePersistenceConfig, request: FetchLike = fetch): TodoRepository {
  if (!config.url || !config.publishableKey) throw new Error('Collaboration persistence requires configured Supabase credentials.');
  const rest = `${config.url.replace(/\/$/, '')}/rest/v1`;
  let configurationFailure: Error | null = null;
  let workspace: WorkspaceRow | null = null;
  const call = async (path: string, init: RequestInit = {}) => {
    if (configurationFailure) throw configurationFailure;
    const accessToken = await config.getAccessToken?.();
    if (!accessToken) throw new Error('Sign in before accessing Tasks.');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response: Response;
    try {
      response = await request(`${rest}${path}`, { ...init, signal: controller.signal, headers: { apikey: config.publishableKey!, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', Accept: 'application/json', ...init.headers } });
    } catch (error) {
      if (controller.signal.aborted) throw new Error('Task request timed out. Check your connection and confirm the collaboration migrations are applied.');
      throw error;
    } finally { window.clearTimeout(timeout); }
    if (!response.ok) {
      let payload: { message?: string; hint?: string; details?: string } = { message: response.statusText };
      try { payload = await response.json() as typeof payload; } catch { /* no JSON */ }
      const error = collaborationError(response.status, payload, path);
      if (error.isConfigurationFailure) configurationFailure = error;
      throw error;
    }
    return response;
  };
  const json = async <T>(path: string, init?: RequestInit) => await (await call(path, init)).json() as T;
  const ensureWorkspace = async () => {
    if (workspace) return workspace;
    workspace = rpcRecord(await json<WorkspaceRow | WorkspaceRow[]>('/rpc/ensure_collaboration_workspace', { method: 'POST', body: JSON.stringify({}) }));
    return workspace;
  };
  const allTasks = () => json<TaskRow[]>('/collaboration_tasks?select=id,list_id,title,note_document,status,priority,due_date,tags,order_key,created_at,updated_at,completed_at,deleted_at&order=order_key.asc');
  const allLists = () => json<ListRow[]>('/collaboration_lists?select=id,title,description,status,created_at,updated_at,deleted_at&order=updated_at.desc');
  const listRows = async () => ({ lists: await allLists(), tasks: await allTasks() });
  const updateTask = async (id: string, body: Record<string, unknown>) => taskFromRow(first(await json<TaskRow[]>(`/collaboration_tasks?id=eq.${encodeURIComponent(id)}&select=id,list_id,title,note_document,status,priority,due_date,tags,order_key,created_at,updated_at,completed_at,deleted_at`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(body) })));
  const updateList = async (id: string, body: Record<string, unknown>) => {
    const row = first(await json<ListRow[]>(`/collaboration_lists?id=eq.${encodeURIComponent(id)}&select=id,title,description,status,created_at,updated_at,deleted_at`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(body) }));
    return listFromRow(row, await allTasks());
  };
  const collaboration = createSupabaseCollaborationGateway(config, request);

  return {
    ...collaboration,
    async getDashboard() {
      const { lists, tasks } = await listRows();
      const visibleLists = lists.filter((list) => list.status !== 'deleted');
      const visibleTasks = tasks.filter((task) => task.status !== 'deleted');
      const summary: DashboardSummary = { listCount: visibleLists.length, completedListCount: visibleLists.filter((list) => list.status === 'completed').length, taskCount: visibleTasks.length, completedCount: visibleTasks.filter((task) => task.status === 'done').length, activeCount: visibleTasks.filter((task) => task.status !== 'done').length };
      return { summary, lists: visibleLists.map((list) => listFromRow(list, tasks)) };
    },
    async listLists() { const { lists, tasks } = await listRows(); return lists.map((list) => listFromRow(list, tasks)); },
    async listListsPage(input: ListPageInput = {}): Promise<CursorPage<TodoList>> {
      const lists = await this.listLists(); const filtered = lists.filter((list) => (!input.status || list.status === input.status) && (!input.query || `${list.title} ${list.description}`.toLowerCase().includes(input.query.toLowerCase())));
      const sorted = [...filtered].sort((a, b) => input.sort === 'title' ? a.title.localeCompare(b.title) : input.sort === 'progress' ? b.completionPercent - a.completionPercent : input.sort === 'tasks' ? b.taskCount - a.taskCount : b.createdAt.localeCompare(a.createdAt));
      const start = Number(input.cursor ?? 0); const limit = Math.max(1, Math.min(input.limit ?? 50, 100)); const items = sorted.slice(start, start + limit); return { items, total: sorted.length, nextCursor: start + limit < sorted.length ? String(start + limit) : null };
    },
    async getList(id) { const { lists, tasks } = await listRows(); const row = lists.find((list) => list.id === id); return row ? listFromRow(row, tasks) : null; },
    async createList(input: TodoListInput) { const row = rpcRecord(await json<ListRow | ListRow[]>('/rpc/create_collaboration_list', { method: 'POST', body: JSON.stringify({ p_title: input.title, p_description: input.description ?? '' }) })); return listFromRow(row, []); },
    async updateList(id, input: TodoListUpdateInput) { return updateList(id, { ...input }); },
    async archiveList(id) { return updateList(id, { status: 'archived' }); },
    async restoreList(id) { return updateList(id, { status: 'active' }); },
    async deleteList(id) { return updateList(id, { status: 'deleted', deleted_at: new Date().toISOString() }); },
    async listTasks(listId) { return (await allTasks()).filter((task) => task.list_id === listId).map(taskFromRow); },
    async getTask(id) { const rows = await json<TaskRow[]>(`/collaboration_tasks?id=eq.${encodeURIComponent(id)}&select=id,list_id,title,note_document,status,priority,due_date,tags,order_key,created_at,updated_at,completed_at,deleted_at`); return rows[0] ? taskFromRow(rows[0]) : null; },
    async createTask(input: TodoTaskInput) { const row = rpcRecord(await json<TaskRow | TaskRow[]>('/rpc/create_collaboration_task', { method: 'POST', body: JSON.stringify({ p_list_id: input.listId, p_title: input.title, p_note_document: input.notes ?? '', p_priority: input.priority ?? 'medium', p_due_date: input.dueDate ?? null, p_tags: input.tags ?? [], p_order_key: Date.now() }) })); return taskFromRow(row); },
    async updateTask(id, input: TodoTaskUpdateInput) { const body: Record<string, unknown> = { ...input }; if ('notes' in body) { body.note_document = body.notes; delete body.notes; } if ('dueDate' in body) { body.due_date = body.dueDate; delete body.dueDate; } return updateTask(id, body); },
    async completeTask(id, isComplete) { return updateTask(id, { status: isComplete ? 'done' : 'todo' }); },
    async deleteTask(id) { return updateTask(id, { status: 'deleted', deleted_at: new Date().toISOString() }); },
    async restoreTask(id) { return updateTask(id, { status: 'todo', deleted_at: null }); },
    async listActivity(): Promise<ActivityEvent[]> { return []; },
    async listActivityPage(_input: CursorPageInput = {}): Promise<CursorPage<ActivityEvent>> { return { items: [], total: 0, nextCursor: null }; },
    async clearActivity() { /* Activity persistence is added with real-time audit events. */ },
    async listTemplates(): Promise<ListTemplate[]> { return []; },
    async search({ query }) { const normalized = query.trim().toLowerCase(); const { lists, tasks } = await listRows(); const results: SearchResult[] = [ ...lists.filter((item) => `${item.title} ${item.description}`.toLowerCase().includes(normalized)).map((item) => ({ id: item.id, kind: 'list' as const, scope: 'List', title: item.title, description: item.description })), ...tasks.filter((item) => `${item.title} ${item.note_document}`.toLowerCase().includes(normalized)).map((item) => ({ id: item.id, kind: 'task' as const, scope: 'Task', title: item.title, description: item.note_document })) ]; return { query, results }; },
    async exportWorkspace() { const [lists, tasks] = await Promise.all([this.listLists(), allTasks().then((rows) => rows.map(taskFromRow))]); return { lists, tasks, activity: [], templates: [] }; },
    async importWorkspace() { throw new Error('Import is temporarily unavailable while collaboration-safe bulk import is completed.'); },
  };
}
