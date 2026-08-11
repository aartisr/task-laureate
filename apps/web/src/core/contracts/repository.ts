import type {
  ActivityEvent,
  DashboardSummary,
  ListTemplate,
  SearchResult,
  TodoItem,
  TodoItemStatus,
  TodoList,
  TodoListStatus,
  Priority,
} from './domain';
import type { Collaborator, CollaboratorRole, EffectiveRole, ShareInvitation, ShareResourceType, SharedResource } from '../domain/sharing';
import type { TaskAttachment } from '../domain/attachments';

export interface TodoListInput {
  title: string;
  description?: string;
  templateId?: string | null;
}

export interface TodoListUpdateInput {
  title?: string;
  description?: string;
  status?: TodoListStatus;
}

export interface TodoTaskInput {
  listId: string;
  title: string;
  notes?: string;
  priority?: Priority;
  dueDate?: string | null;
  tags?: string[];
}

export interface TodoTaskUpdateInput {
  title?: string;
  notes?: string;
  priority?: Priority;
  dueDate?: string | null;
  tags?: string[];
  status?: TodoItemStatus;
}

export interface SearchInput {
  query: string;
}

export interface WorkspaceArchiveData {
  lists: TodoList[];
  tasks: TodoItem[];
  activity: ActivityEvent[];
  templates: ListTemplate[];
}

export interface ShareResourceInput {
  resourceType: ShareResourceType;
  resourceId: string;
}

export interface CreateShareInvitationInput extends ShareResourceInput {
  email: string;
  role: CollaboratorRole;
}

/** Optional capability: private-only repositories intentionally do not expose it. */
export interface CollaborationRepository {
  listSharedResources(): Promise<SharedResource[]>;
  /** Database-authoritative role for the signed-in user on one resource. */
  getResourceAccess(input: ShareResourceInput): Promise<EffectiveRole>;
  listCollaborators(input: ShareResourceInput): Promise<Collaborator[]>;
  listOutgoingInvitations(input: ShareResourceInput): Promise<ShareInvitation[]>;
  createShareInvitation(input: CreateShareInvitationInput): Promise<{ invitation: ShareInvitation; acceptanceUrl?: string; delivery: 'sent' | 'manual' }>;
  acceptShareInvitation(token: string): Promise<{ resourceType: ShareResourceType; resourceId: string; role: CollaboratorRole }>;
  revokeShareInvitation(invitationId: string): Promise<void>;
  revokeResourceAccess(input: ShareResourceInput & { userId: string }): Promise<void>;
}

export function supportsCollaboration(repository: TodoRepository): repository is TodoRepository & CollaborationRepository {
  return 'listCollaborators' in repository && 'getResourceAccess' in repository && 'createShareInvitation' in repository;
}

/**
 * Transport-neutral keyset page. `nextCursor` is deliberately opaque: callers
 * must return it unchanged, which lets a database replace the in-memory store
 * without changing the UI or public repository contract.
 */
export interface CursorPageInput {
  cursor?: string | null;
  limit?: number;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  total: number;
}

export interface ListPageInput extends CursorPageInput {
  status?: TodoListStatus;
  query?: string;
  sort?: 'title' | 'progress' | 'tasks' | 'created';
}

export interface TaskFeedInput {
  status?: TodoItemStatus | 'all';
  priority?: Priority | 'all';
  query?: string;
  cursor?: string | null;
  limit?: number;
}

export interface TaskFeedItem extends TodoItem {
  listTitle: string;
}

export interface TaskFeedPage {
  items: TaskFeedItem[];
  nextCursor: string | null;
}

/** Optional bounded read path for remote repositories with server-side feeds. */
export interface ScalableTaskFeedRepository {
  listTaskFeed(input?: TaskFeedInput): Promise<TaskFeedPage>;
}

export function supportsScalableTaskFeed(repository: TodoRepository): repository is TodoRepository & ScalableTaskFeedRepository {
  return 'listTaskFeed' in repository;
}

/** Optional capability for storage-backed task references. */
export interface AttachmentRepository {
  listAttachments(taskId: string): Promise<TaskAttachment[]>;
  uploadAttachment(taskId: string, file: File, onProgress?: (percent: number) => void): Promise<TaskAttachment>;
  getAttachmentUrl(attachment: TaskAttachment, variant?: 'thumbnail' | 'preview' | 'original'): Promise<string>;
  deleteAttachment(attachment: TaskAttachment): Promise<void>;
}

export function supportsAttachments(repository: TodoRepository): repository is TodoRepository & AttachmentRepository {
  return 'listAttachments' in repository && 'uploadAttachment' in repository && 'getAttachmentUrl' in repository;
}

export interface TodoRepository {
  getDashboard(): Promise<{ summary: DashboardSummary; lists: TodoList[] }>;
  listLists(): Promise<TodoList[]>;
  listListsPage(input?: ListPageInput): Promise<CursorPage<TodoList>>;
  getList(listId: string): Promise<TodoList | null>;
  createList(input: TodoListInput): Promise<TodoList>;
  updateList(listId: string, input: TodoListUpdateInput): Promise<TodoList>;
  archiveList(listId: string): Promise<TodoList>;
  restoreList(listId: string): Promise<TodoList>;
  deleteList(listId: string): Promise<TodoList>;
  listTasks(listId: string): Promise<TodoItem[]>;
  getTask(taskId: string): Promise<TodoItem | null>;
  createTask(input: TodoTaskInput): Promise<TodoItem>;
  updateTask(taskId: string, input: TodoTaskUpdateInput): Promise<TodoItem>;
  completeTask(taskId: string, isComplete: boolean): Promise<TodoItem>;
  deleteTask(taskId: string): Promise<TodoItem>;
  restoreTask(taskId: string): Promise<TodoItem>;
  listActivity(): Promise<ActivityEvent[]>;
  listActivityPage(input?: CursorPageInput): Promise<CursorPage<ActivityEvent>>;
  /** Removes the signed-in user's audit timeline, never lists or tasks. */
  clearActivity(): Promise<void>;
  listTemplates(): Promise<ListTemplate[]>;
  search(input: SearchInput): Promise<{ query: string; results: SearchResult[] }>;
  exportWorkspace(): Promise<WorkspaceArchiveData>;
  importWorkspace(workspace: WorkspaceArchiveData): Promise<void>;
}
