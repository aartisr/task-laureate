import type { ActivityEvent, DashboardSummary, ListTemplate, SearchResult, TodoItem, TodoList } from '../../core/contracts/domain';
import type { AttachmentRepository, CollaborationRepository, CursorPage, CursorPageInput, DependencyRepository, IdempotentCreationRepository, ListPageInput, ReportingRepository, ScalableTaskFeedRepository, TaskFeedInput, TaskFeedPage, TodoListInput, TodoListUpdateInput, TodoRepository, TodoTaskInput, TodoTaskUpdateInput, WorkspaceReport } from '../../core/contracts/repository';
import { classifyAttachment, type TaskAttachment } from '../../core/domain/attachments';
import type { DependencyTaskRef, TaskDependency, TaskDependencySummary } from '../../core/domain/dependencies';
import type { CaptureRepository, CaptureTaskRepository, TaskEventFeedRepository, TaskEventRepository, TaskPlanningRepository } from '../../core/contracts/antiBacklog';
import type { DecompositionStep, TaskPlanningMetadata } from '../../core/domain/antiBacklog';
import { createSupabaseCollaborationGateway } from './collaborationGateway';
import type { SupabasePersistenceConfig } from './config';
import { collaborationError } from './collaborationErrors';
import { sortListsForAttention } from '../../core/domain/listOrdering';

type FetchLike = typeof fetch;
type ListRow = { id: string; title: string; description: string; status: TodoList['status']; created_at: string; updated_at: string; deleted_at: string | null };
type TaskRow = { id: string; list_id: string; title: string; note_document: string; status: TodoItem['status']; priority: TodoItem['priority']; due_date: string | null; tags: string[]; order_key: number; created_at: string; updated_at: string; completed_at: string | null; deleted_at: string | null };
type DashboardRpc = { summary: { listCount: number; completedListCount: number; taskCount: number; completedCount: number; activeCount: number }; lists: Array<ListRow & { task_count: number; completed_task_count: number }> };
type TaskFeedRow = TaskRow & { list_title: string; next_cursor: string | null };
type ListPageRow = ListRow & { task_count: number; completed_task_count: number; next_cursor: string | null };
type AttachmentRow = { id: string; task_id: string; original_name: string; content_type: string; byte_size: number; kind: TaskAttachment['kind']; status: TaskAttachment['status']; object_path: string; thumbnail_path: string | null; preview_path: string | null; created_at: string };
type DependencyTaskRow = { id: string; title: string; status: TodoItem['status']; due_date: string | null };
type DependencyRow = { id: string; prerequisite_task_id: string; dependent_task_id: string; dependency_type: TaskDependency['type']; is_required: boolean; created_at: string; prerequisite: DependencyTaskRow; dependent: DependencyTaskRow };
type DependencySummaryRow = { task_id: string; unresolved_prerequisite_count: number; dependent_count: number };
type PlanningRow = { task_id: string; estimate_minutes: number | null; energy_level: TaskPlanningMetadata['energyLevel']; scheduled_start_at: string | null; parent_task_id: string | null; needs_clarity: boolean };
type TaskEventRow = { id: string; task_id: string; event_type: string; occurred_at: string; payload: Record<string, unknown> | null };
type WorkspaceReportRpc = { lists: Array<ListRow & { task_count: number; completed_task_count: number }>; tasks: TaskFeedRow[]; task_limit: number; is_truncated: boolean };
const REQUEST_TIMEOUT_MS = 15_000;

function listFromRow(row: ListRow, tasks: TaskRow[]): TodoList {
  const ownTasks = tasks.filter((task) => task.list_id === row.id && task.status !== 'deleted');
  const completed = ownTasks.filter((task) => task.status === 'done').length;
  return { id: row.id, title: row.title, description: row.description, status: row.status, templateId: null, createdAt: row.created_at, updatedAt: row.updated_at, archivedAt: row.status === 'archived' ? row.updated_at : null, completedAt: row.status === 'completed' ? row.updated_at : null, deletedAt: row.deleted_at, taskCount: ownTasks.length, completedTaskCount: completed, completionPercent: ownTasks.length ? Math.round(completed / ownTasks.length * 100) : 0 };
}
function listFromSummaryRow(row: ListRow & { task_count: number; completed_task_count: number }): TodoList {
  const taskCount = Number(row.task_count ?? 0); const completedTaskCount = Number(row.completed_task_count ?? 0);
  return { id: row.id, title: row.title, description: row.description, status: row.status, templateId: null, createdAt: row.created_at, updatedAt: row.updated_at, archivedAt: row.status === 'archived' ? row.updated_at : null, completedAt: row.status === 'completed' ? row.updated_at : null, deletedAt: row.deleted_at, taskCount, completedTaskCount, completionPercent: taskCount ? Math.round(completedTaskCount / taskCount * 100) : 0 };
}
function taskFromRow(row: TaskRow): TodoItem { return { id: row.id, listId: row.list_id, title: row.title, notes: row.note_document, status: row.status, priority: row.priority, dueDate: row.due_date, tags: row.tags ?? [], order: Number(row.order_key), createdAt: row.created_at, updatedAt: row.updated_at, completedAt: row.completed_at, deletedAt: row.deleted_at }; }
function attachmentFromRow(row: AttachmentRow): TaskAttachment { return { id: row.id, taskId: row.task_id, name: row.original_name, contentType: row.content_type, byteSize: Number(row.byte_size), kind: row.kind, status: row.status, objectPath: row.object_path, thumbnailPath: row.thumbnail_path, previewPath: row.preview_path, createdAt: row.created_at }; }
function dependencyTaskFromRow(row: DependencyTaskRow): DependencyTaskRef { return { id: row.id, title: row.title, status: row.status, dueDate: row.due_date }; }
function dependencyFromRow(row: DependencyRow): TaskDependency { return { id: row.id, prerequisiteTask: dependencyTaskFromRow(row.prerequisite), dependentTask: dependencyTaskFromRow(row.dependent), type: row.dependency_type, required: row.is_required, createdAt: row.created_at }; }
function first<T>(rows: T[]): T { if (!rows[0]) throw new Error('The requested resource was not returned. It may have changed or you may no longer have access.'); return rows[0]; }
function rpcRecord<T>(value: T | T[]): T { return Array.isArray(value) ? first(value) : value; }

/**
 * Normalized, RLS-enforced persistence. All resource authorization stays in
 * Postgres; this adapter only maps the public domain contract to Data API calls.
 * It is composed with the collaboration gateway rather than duplicating invite code.
 */
export function createSupabaseCollaborationTodoRepository(config: SupabasePersistenceConfig, request: FetchLike = fetch): TodoRepository & CollaborationRepository & ScalableTaskFeedRepository & ReportingRepository & AttachmentRepository & DependencyRepository & TaskPlanningRepository & TaskEventRepository & TaskEventFeedRepository & CaptureRepository & CaptureTaskRepository & IdempotentCreationRepository {
  if (!config.url || !config.publishableKey) throw new Error('Collaboration persistence requires configured Supabase credentials.');
  const rest = `${config.url.replace(/\/$/, '')}/rest/v1`;
  const storage = `${config.url.replace(/\/$/, '')}/storage/v1`;
  let configurationFailure: Error | null = null;
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
  const storageCall = async (path: string, init: RequestInit = {}) => {
    const accessToken = await config.getAccessToken?.();
    if (!accessToken) throw new Error('Sign in before uploading an attachment.');
    const response = await request(`${storage}${path}`, { ...init, headers: { apikey: config.publishableKey!, Authorization: `Bearer ${accessToken}`, ...init.headers } });
    if (!response.ok) throw new Error(`Attachment request failed (${response.status}).`);
    return response;
  };
  const allTasks = () => json<TaskRow[]>('/collaboration_tasks?select=id,list_id,title,note_document,status,priority,due_date,tags,order_key,created_at,updated_at,completed_at,deleted_at&order=order_key.asc');
  const allLists = () => json<ListRow[]>('/collaboration_lists?select=id,title,description,status,created_at,updated_at,deleted_at&order=updated_at.desc');
  const listRows = async () => ({ lists: await allLists(), tasks: await allTasks() });
  const updateTask = async (id: string, body: Record<string, unknown>) => taskFromRow(first(await json<TaskRow[]>(`/collaboration_tasks?id=eq.${encodeURIComponent(id)}&select=id,list_id,title,note_document,status,priority,due_date,tags,order_key,created_at,updated_at,completed_at,deleted_at`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(body) })));
  const updateList = async (id: string, body: Record<string, unknown>) => {
    const row = first(await json<ListRow[]>(`/collaboration_lists?id=eq.${encodeURIComponent(id)}&select=id,title,description,status,created_at,updated_at,deleted_at`, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(body) }));
    return listFromRow(row, await json<TaskRow[]>(`/collaboration_tasks?list_id=eq.${encodeURIComponent(id)}&status=neq.deleted&select=id,list_id,title,note_document,status,priority,due_date,tags,order_key,created_at,updated_at,completed_at,deleted_at&order=order_key.asc`));
  };
  const dependencySelect = 'id,prerequisite_task_id,dependent_task_id,dependency_type,is_required,created_at,prerequisite:collaboration_tasks!task_dependencies_prerequisite_task_id_fkey(id,title,status,due_date),dependent:collaboration_tasks!task_dependencies_dependent_task_id_fkey(id,title,status,due_date)';
  const dependenciesForTask = async (taskId: string) => {
    const encoded = encodeURIComponent(taskId);
    const [incoming, outgoing] = await Promise.all([
      json<DependencyRow[]>(`/task_dependencies?dependent_task_id=eq.${encoded}&select=${dependencySelect}&order=created_at.asc`),
      json<DependencyRow[]>(`/task_dependencies?prerequisite_task_id=eq.${encoded}&select=${dependencySelect}&order=created_at.asc`),
    ]);
    return [...incoming, ...outgoing.filter((row) => !incoming.some((existing) => existing.id === row.id))].map(dependencyFromRow);
  };
  const collaboration = createSupabaseCollaborationGateway(config, request);
  const planningFromRow = (row: PlanningRow): TaskPlanningMetadata => ({ estimateMinutes: row.estimate_minutes, energyLevel: row.energy_level, scheduledStartAt: row.scheduled_start_at, parentTaskId: row.parent_task_id, needsClarity: row.needs_clarity });

  return {
    ...collaboration,
    async getDashboard() {
      const payload = await json<DashboardRpc>('/rpc/get_collaboration_dashboard', { method: 'POST', body: JSON.stringify({ p_recent_limit: 6 }) });
      return { summary: payload.summary as DashboardSummary, lists: payload.lists.map(listFromSummaryRow) };
    },
    async listLists() { const { lists, tasks } = await listRows(); return sortListsForAttention(lists.map((list) => listFromRow(list, tasks))); },
    async listListsPage(input: ListPageInput = {}): Promise<CursorPage<TodoList>> {
      const limit = Math.max(1, Math.min(input.limit ?? 24, 100));
      const rows = await json<ListPageRow[]>('/rpc/list_collaboration_lists_page', { method: 'POST', body: JSON.stringify({ p_status: input.status ?? null, p_query: input.query?.trim() || null, p_cursor: input.cursor ? new Date(input.cursor).toISOString() : null, p_limit: limit }) });
      return { items: rows.map(listFromSummaryRow), total: rows.length, nextCursor: rows.length === limit ? rows.at(-1)?.next_cursor ?? null : null };
    },
    async getList(id) {
      const rows = await json<ListRow[]>(`/collaboration_lists?id=eq.${encodeURIComponent(id)}&select=id,title,description,status,created_at,updated_at,deleted_at`);
      const row = rows[0];
      return row ? listFromRow(row, await json<TaskRow[]>(`/collaboration_tasks?list_id=eq.${encodeURIComponent(id)}&status=neq.deleted&select=id,list_id,title,note_document,status,priority,due_date,tags,order_key,created_at,updated_at,completed_at,deleted_at&order=order_key.asc`)) : null;
    },
    async createList(input: TodoListInput) { const row = rpcRecord(await json<ListRow | ListRow[]>('/rpc/create_collaboration_list', { method: 'POST', body: JSON.stringify({ p_title: input.title, p_description: input.description ?? '' }) })); return listFromRow(row, []); },
    async createListIdempotent(input, idempotencyKey) { const row = rpcRecord(await json<ListRow | ListRow[]>('/rpc/create_collaboration_list', { method: 'POST', body: JSON.stringify({ p_title: input.title, p_description: input.description ?? '', p_idempotency_key: idempotencyKey }) })); return listFromRow(row, []); },
    async updateList(id, input: TodoListUpdateInput) { return updateList(id, { ...input }); },
    async archiveList(id) { return updateList(id, { status: 'archived' }); },
    async restoreList(id) { return updateList(id, { status: 'active' }); },
    async deleteList(id) { return updateList(id, { status: 'deleted', deleted_at: new Date().toISOString() }); },
    async listTasks(listId) { return (await json<TaskRow[]>(`/collaboration_tasks?list_id=eq.${encodeURIComponent(listId)}&status=neq.deleted&select=id,list_id,title,note_document,status,priority,due_date,tags,order_key,created_at,updated_at,completed_at,deleted_at&order=order_key.asc`)).map(taskFromRow); },
    async listTaskFeed(input: TaskFeedInput = {}): Promise<TaskFeedPage> {
      const cursor = input.cursor ? new Date(input.cursor).toISOString() : null;
      const rows = await json<TaskFeedRow[]>('/rpc/list_collaboration_task_feed', { method: 'POST', body: JSON.stringify({ p_status: input.status && input.status !== 'all' ? input.status : null, p_priority: input.priority && input.priority !== 'all' ? input.priority : null, p_query: input.query?.trim() || null, p_cursor: cursor, p_limit: Math.max(1, Math.min(input.limit ?? 50, 100)) }) });
      const nextCursor = rows.length === (input.limit ?? 50) ? rows.at(-1)?.next_cursor ?? null : null;
      return { items: rows.map((row) => ({ ...taskFromRow(row), listTitle: row.list_title })), nextCursor };
    },
    async getWorkspaceReport(input = {}): Promise<WorkspaceReport> {
      const taskLimit = Math.max(1, Math.min(input.taskLimit ?? 300, 500));
      const payload = await json<WorkspaceReportRpc>('/rpc/get_collaboration_workspace_report', { method: 'POST', body: JSON.stringify({ p_task_limit: taskLimit }) });
      return { lists: payload.lists.map(listFromSummaryRow), tasks: payload.tasks.map((row) => ({ ...taskFromRow(row), listTitle: row.list_title })), taskLimit: payload.task_limit, isTruncated: payload.is_truncated };
    },
    async getTask(id) { const rows = await json<TaskRow[]>(`/collaboration_tasks?id=eq.${encodeURIComponent(id)}&select=id,list_id,title,note_document,status,priority,due_date,tags,order_key,created_at,updated_at,completed_at,deleted_at`); return rows[0] ? taskFromRow(rows[0]) : null; },
    async getTaskPlanning(taskId) {
      const rows = await json<PlanningRow[]>(`/task_planning_metadata?task_id=eq.${encodeURIComponent(taskId)}&select=task_id,estimate_minutes,energy_level,scheduled_start_at,parent_task_id,needs_clarity`);
      return rows[0] ? planningFromRow(rows[0]) : null;
    },
    async saveTaskPlanning(taskId, metadata) {
      const row = rpcRecord(await json<PlanningRow | PlanningRow[]>('/rpc/set_task_planning_metadata', {
        method: 'POST',
        body: JSON.stringify({ p_task_id: taskId, p_estimate_minutes: metadata.estimateMinutes, p_energy_level: metadata.energyLevel, p_scheduled_start_at: metadata.scheduledStartAt, p_parent_task_id: metadata.parentTaskId }),
      }));
      return planningFromRow(row);
    },
    async saveAcceptedSteps(taskId, steps: DecompositionStep[], origin = 'template') {
      await json<unknown>('/rpc/accept_task_plan', {
        method: 'POST',
        body: JSON.stringify({ p_task_id: taskId, p_steps: steps, p_origin: origin, p_idempotency_key: `steps:${taskId}:${crypto.randomUUID()}` }),
      });
    },
    async recordTaskEvent(input) {
      await call('/rpc/record_task_event', { method: 'POST', body: JSON.stringify({ p_task_id: input.taskId, p_event_type: input.type, p_idempotency_key: input.idempotencyKey, p_payload: input.payload ?? {} }) });
    },
    async listTaskEvents(input = {}) { const since = input.since ? `&occurred_at=gte.${encodeURIComponent(input.since)}` : ''; const limit = Math.max(1, Math.min(input.limit ?? 200, 500)); const rows = await json<TaskEventRow[]>(`/task_events?select=id,task_id,event_type,occurred_at,payload${since}&order=occurred_at.desc&limit=${limit}`); return rows.map((row) => ({ id: row.id, taskId: row.task_id, type: row.event_type, occurredAt: row.occurred_at, payload: row.payload ?? {} })); },
    async saveCaptureIntent(input) {
      const idempotencyKey = `capture:${crypto.randomUUID()}`;
      const saved = rpcRecord(await json<{ id: string } | Array<{ id: string }>>('/rpc/record_task_capture_intent', {
        method: 'POST', body: JSON.stringify({ p_idempotency_key: idempotencyKey, p_raw_input: input.rawInput, p_parsed: input.parsed, p_parser_version: 'deterministic-v1' }),
      }));
      return { id: saved.id };
    },
    async captureTask(input) {
      const row = rpcRecord(await json<TaskRow | TaskRow[]>('/rpc/capture_task', {
        method: 'POST',
        body: JSON.stringify({ p_idempotency_key: input.idempotencyKey, p_raw_input: input.rawInput, p_parsed: input.parsed, p_list_id: input.listId ?? null }),
      }));
      return taskFromRow(row);
    },
    async listDependencies(taskId) { return dependenciesForTask(taskId); },
    async getDependencySummary(taskId): Promise<TaskDependencySummary> {
      const dependencies = await dependenciesForTask(taskId);
      const unresolvedPrerequisiteCount = dependencies.filter((edge) => edge.dependentTask.id === taskId && edge.required && edge.type === 'finish_to_start' && edge.prerequisiteTask.status !== 'done').length;
      return { unresolvedPrerequisiteCount, dependentCount: dependencies.filter((edge) => edge.prerequisiteTask.id === taskId).length, isReadyToComplete: unresolvedPrerequisiteCount === 0 };
    },
    async getDependencySummaries(taskIds) {
      if (!taskIds.length) return {};
      const rows = await json<DependencySummaryRow[]>('/rpc/get_task_dependency_summaries', { method: 'POST', body: JSON.stringify({ p_task_ids: taskIds }) });
      return Object.fromEntries(rows.map((row) => [row.task_id, { unresolvedPrerequisiteCount: Number(row.unresolved_prerequisite_count), dependentCount: Number(row.dependent_count), isReadyToComplete: Number(row.unresolved_prerequisite_count) === 0 }]));
    },
    async createDependency(input) {
      const row = rpcRecord(await json<Pick<DependencyRow, 'id'> | Array<Pick<DependencyRow, 'id'>>>(`/task_dependencies?select=id`, { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ prerequisite_task_id: input.prerequisiteTaskId, dependent_task_id: input.dependentTaskId, dependency_type: input.type ?? 'finish_to_start', is_required: input.required ?? true }) }));
      const edge = (await dependenciesForTask(input.dependentTaskId)).find((candidate) => candidate.id === row.id);
      if (!edge) throw new Error('The dependency was created but could not be read back. Refresh and try again.');
      return edge;
    },
    async removeDependency(dependencyId) { await call(`/task_dependencies?id=eq.${encodeURIComponent(dependencyId)}`, { method: 'DELETE' }); },
    async listAttachments(taskId) {
      const rows = await json<AttachmentRow[]>(`/task_attachments?task_id=eq.${encodeURIComponent(taskId)}&deleted_at=is.null&select=id,task_id,original_name,content_type,byte_size,kind,status,object_path,thumbnail_path,preview_path,created_at&order=created_at.desc`);
      return rows.map(attachmentFromRow);
    },
    async uploadAttachment(taskId, file, onProgress) {
      if (file.size <= 0 || file.size > 100 * 1024 * 1024) throw new Error('Attachments must be between 1 byte and 100 MB.');
      const attachmentId = crypto.randomUUID();
      const objectPath = `tasks/${taskId}/${attachmentId}/original`;
      onProgress?.(0);
      await storageCall(`/object/task-attachments/${objectPath}`, { method: 'POST', headers: { 'Content-Type': file.type, 'x-upsert': 'false', 'cache-control': '31536000' }, body: file });
      onProgress?.(85);
      try {
        const row = rpcRecord(await json<AttachmentRow | AttachmentRow[]>('/task_attachments?select=id,task_id,original_name,content_type,byte_size,kind,status,object_path,thumbnail_path,preview_path,created_at', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ id: attachmentId, task_id: taskId, object_path: objectPath, original_name: file.name.slice(0, 255), content_type: file.type, byte_size: file.size, kind: classifyAttachment(file.type), status: 'ready' }) }));
        onProgress?.(100);
        return attachmentFromRow(row);
      } catch (error) {
        void storageCall(`/object/task-attachments/${objectPath}`, { method: 'DELETE' });
        throw error;
      }
    },
    async getAttachmentUrl(attachment, variant = 'original') {
      const path = variant === 'thumbnail' ? attachment.thumbnailPath ?? attachment.objectPath : variant === 'preview' ? attachment.previewPath ?? attachment.objectPath : attachment.objectPath;
      const response = await storageCall(`/object/sign/task-attachments/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 300 }) });
      const payload = await response.json() as { signedURL?: string };
      if (!payload.signedURL) throw new Error('A secure attachment link could not be created.');
      return `${storage}${payload.signedURL}`;
    },
    async deleteAttachment(attachment) {
      const paths = [attachment.objectPath, attachment.thumbnailPath, attachment.previewPath].filter((path): path is string => Boolean(path));
      // Supabase expressly blocks direct SQL writes to storage.objects. Its
      // Storage API deletes all variants in one request, after bucket RLS has
      // authorized every object path.
      await storageCall('/object/task-attachments', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: paths }) });
      await call(`/task_attachments?id=eq.${encodeURIComponent(attachment.id)}`, { method: 'DELETE' });
    },
    async createTask(input: TodoTaskInput) { const row = rpcRecord(await json<TaskRow | TaskRow[]>('/rpc/create_collaboration_task', { method: 'POST', body: JSON.stringify({ p_list_id: input.listId, p_title: input.title, p_note_document: input.notes ?? '', p_priority: input.priority ?? 'medium', p_due_date: input.dueDate ?? null, p_tags: input.tags ?? [], p_order_key: Date.now() }) })); return taskFromRow(row); },
    async createTaskIdempotent(input, idempotencyKey) { const row = rpcRecord(await json<TaskRow | TaskRow[]>('/rpc/create_collaboration_task', { method: 'POST', body: JSON.stringify({ p_list_id: input.listId, p_title: input.title, p_note_document: input.notes ?? '', p_priority: input.priority ?? 'medium', p_due_date: input.dueDate ?? null, p_tags: input.tags ?? [], p_order_key: Date.now(), p_idempotency_key: idempotencyKey }) })); return taskFromRow(row); },
    async updateTask(id, input: TodoTaskUpdateInput) { const body: Record<string, unknown> = { ...input }; if ('notes' in body) { body.note_document = body.notes; delete body.notes; } if ('dueDate' in body) { body.due_date = body.dueDate; delete body.dueDate; } return updateTask(id, body); },
    async moveTask(id, destinationListId) { const row = rpcRecord(await json<TaskRow | TaskRow[]>('/rpc/move_collaboration_task', { method: 'POST', body: JSON.stringify({ p_task_id: id, p_destination_list_id: destinationListId }) })); return taskFromRow(row); },
    async completeTask(id, isComplete) { return updateTask(id, { status: isComplete ? 'done' : 'todo' }); },
    async deleteTask(id) { return updateTask(id, { status: 'deleted', deleted_at: new Date().toISOString() }); },
    async restoreTask(id) { return updateTask(id, { status: 'todo', deleted_at: null }); },
    async listActivity(): Promise<ActivityEvent[]> { return []; },
    async listActivityPage(_input: CursorPageInput = {}): Promise<CursorPage<ActivityEvent>> { return { items: [], total: 0, nextCursor: null }; },
    async clearActivity() { /* Activity persistence is added with real-time audit events. */ },
    async listTemplates(): Promise<ListTemplate[]> { return []; },
    async search({ query }) { const normalized = query.trim().toLowerCase(); const { lists, tasks } = await listRows(); const listById = new Map(lists.map((list) => [list.id, list])); const results: SearchResult[] = [ ...sortListsForAttention(lists.map((list) => listFromRow(list, tasks)).filter((item) => `${item.title} ${item.description}`.toLowerCase().includes(normalized))).map((item) => ({ id: item.id, kind: 'list' as const, scope: 'List', title: item.title, description: item.description })), ...tasks.filter((item) => `${item.title} ${item.note_document}`.toLowerCase().includes(normalized)).sort((left, right) => { const leftList = listById.get(left.list_id); const rightList = listById.get(right.list_id); return (leftList?.status === 'active' ? 0 : 1) - (rightList?.status === 'active' ? 0 : 1) || right.updated_at.localeCompare(left.updated_at) || right.id.localeCompare(left.id); }).map((item) => ({ id: item.id, kind: 'task' as const, scope: 'Task', title: item.title, description: item.note_document })) ]; return { query, results }; },
    async exportWorkspace() { const [lists, tasks] = await Promise.all([this.listLists(), allTasks().then((rows) => rows.map(taskFromRow))]); return { lists, tasks, activity: [], templates: [] }; },
    async importWorkspace() { throw new Error('Import is temporarily unavailable while collaboration-safe bulk import is completed.'); },
  };
}
