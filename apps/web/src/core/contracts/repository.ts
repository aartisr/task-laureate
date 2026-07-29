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

export interface TodoRepository {
  getDashboard(): Promise<{ summary: DashboardSummary; lists: TodoList[] }>;
  listLists(): Promise<TodoList[]>;
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
  listTemplates(): Promise<ListTemplate[]>;
  search(input: SearchInput): Promise<{ query: string; results: SearchResult[] }>;
}
