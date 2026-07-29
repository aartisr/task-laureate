export type EntityId = string;

export type TodoListStatus = 'active' | 'archived' | 'deleted';
export type TodoItemStatus = 'todo' | 'doing' | 'done' | 'blocked' | 'deleted';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type ActivityAction =
  | 'created'
  | 'updated'
  | 'completed'
  | 'deleted'
  | 'restored'
  | 'archived'
  | 'moved';

export interface TodoList {
  id: EntityId;
  title: string;
  description: string;
  status: TodoListStatus;
  templateId: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  deletedAt: string | null;
  completionPercent: number;
  taskCount: number;
  completedTaskCount: number;
}

export interface TodoItem {
  id: EntityId;
  listId: EntityId;
  title: string;
  notes: string;
  status: TodoItemStatus;
  priority: Priority;
  dueDate: string | null;
  tags: string[];
  order: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  deletedAt: string | null;
}

export interface ActivityEvent {
  id: EntityId;
  entityType: 'list' | 'task' | 'template' | 'workspace';
  entityId: EntityId;
  action: ActivityAction;
  actor: string;
  timestamp: string;
  metadata: Record<string, string | number | boolean | null>;
}

export interface ListTemplate {
  id: EntityId;
  title: string;
  description: string;
  listDefaults: Pick<TodoList, 'title' | 'description'>;
  taskDefaults: Array<Pick<TodoItem, 'title' | 'notes' | 'priority' | 'tags'>>;
}

export interface DashboardSummary {
  listCount: number;
  taskCount: number;
  completedCount: number;
  activeCount: number;
}

export interface SearchResult {
  id: EntityId;
  kind: 'list' | 'task';
  scope: string;
  title: string;
  description: string;
}
