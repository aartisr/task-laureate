/**
 * Generic Repository Abstraction Layer
 * 
 * This module defines the contract that all database adapters must implement.
 * It's completely database-agnostic and can work with:
 * - PostgreSQL (via Prisma)
 * - MySQL (via Prisma)
 * - MongoDB (via Prisma)
 * - Firebase (custom adapter)
 * - SQLite (via Prisma)
 * 
 * The adapter pattern allows swapping implementations without changing application code.
 */

// ============================================================================
// Domain Types (shared across adapters)
// ============================================================================

export type TaskStatus = 'TODO' | 'DOING' | 'DONE' | 'BLOCKED';
export type ListStatus = 'ACTIVE' | 'ARCHIVED';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface TodoItem {
  id: string;
  listId: string;
  title: string;
  notes: string;
  status: TaskStatus;
  priority: Priority;
  dueDate: Date | null;
  tags: string[];
  order: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  deletedAt: Date | null;
}

export interface TodoList {
  id: string;
  title: string;
  description: string;
  status: ListStatus;
  templateId: string | null;
  taskCount: number;
  completedTaskCount: number;
  completionPercent: number;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
  deletedAt: Date | null;
}

export interface ActivityEvent {
  id: string;
  entityType: 'list' | 'task';
  entityId: string;
  action: string;
  actor: string;
  metadata: Record<string, any>;
  timestamp: Date;
  listId?: string;
  taskId?: string;
}

export interface ListTemplate {
  id: string;
  title: string;
  description: string;
  listDefaults: Record<string, any>;
  taskDefaults: Record<string, any>[];
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Query Filters (for flexible searching)
// ============================================================================

export interface ListFilters {
  status?: ListStatus;
  excludeDeleted?: boolean;
  excludeArchived?: boolean;
}

export interface TaskFilters {
  listId?: string;
  status?: TaskStatus;
  priority?: Priority;
  tags?: string[];
  dueDate?: { before?: Date; after?: Date };
  excludeDeleted?: boolean;
  search?: string; // semantic search support
}

export interface ActivityFilters {
  entityType?: 'list' | 'task';
  entityId?: string;
  action?: string;
  timeRange?: { start: Date; end: Date };
  limit?: number;
}

// ============================================================================
// Repository Interface (Generic, Database-Agnostic)
// ============================================================================

export interface IRepository {
  // Connection lifecycle
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  healthCheck(): Promise<boolean>;

  // ---- LIST OPERATIONS ----
  
  /** Get all lists matching filters */
  listLists(filters?: ListFilters): Promise<TodoList[]>;
  
  /** Get a single list by ID */
  getList(id: string): Promise<TodoList | null>;
  
  /** Create a new list */
  createList(data: {
    title: string;
    description?: string;
    templateId?: string;
  }): Promise<TodoList>;
  
  /** Update list properties */
  updateList(id: string, data: Partial<TodoList>): Promise<TodoList>;
  
  /** Archive or delete a list */
  deleteList(id: string, hardDelete?: boolean): Promise<void>;

  // ---- TASK OPERATIONS ----
  
  /** Get all tasks for a list */
  listTasks(listId: string, filters?: TaskFilters): Promise<TodoItem[]>;
  
  /** Get a single task by ID */
  getTask(id: string): Promise<TodoItem | null>;
  
  /** Create a new task in a list */
  createTask(data: {
    listId: string;
    title: string;
    notes?: string;
    priority?: Priority;
    dueDate?: Date;
    tags?: string[];
  }): Promise<TodoItem>;
  
  /** Update task properties */
  updateTask(id: string, data: Partial<TodoItem>): Promise<TodoItem>;
  
  /** Mark task as complete */
  completeTask(id: string): Promise<TodoItem>;
  
  /** Delete or soft-delete a task */
  deleteTask(id: string, hardDelete?: boolean): Promise<void>;
  
  /** Reorder tasks within a list */
  reorderTasks(listId: string, taskOrders: Array<{ id: string; order: number }>): Promise<void>;

  // ---- DASHBOARD OPERATIONS ----
  
  /** Get dashboard data: summary + all active lists with tasks */
  getDashboard(): Promise<{
    summary: {
      totalLists: number;
      totalTasks: number;
      completedTasks: number;
      overdueTasks: number;
    };
    lists: Array<TodoList & { tasks: TodoItem[] }>;
  }>;

  // ---- SEARCH OPERATIONS ----
  
  /** Full-text search across tasks (semantic or keyword) */
  searchTasks(query: string, filters?: TaskFilters): Promise<TodoItem[]>;
  
  /** Advanced task search with complex filters */
  findTasks(filters: TaskFilters): Promise<TodoItem[]>;

  // ---- ACTIVITY / AUDIT OPERATIONS ----
  
  /** Get activity log */
  getActivity(filters?: ActivityFilters): Promise<ActivityEvent[]>;
  
  /** Record an activity event */
  recordActivity(data: {
    entityType: 'list' | 'task';
    entityId: string;
    action: string;
    actor?: string;
    metadata?: Record<string, any>;
  }): Promise<ActivityEvent>;

  // ---- TEMPLATE OPERATIONS ----
  
  /** Get all available templates */
  listTemplates(): Promise<ListTemplate[]>;
  
  /** Get a single template */
  getTemplate(id: string): Promise<ListTemplate | null>;
  
  /** Create a new template */
  createTemplate(data: {
    title: string;
    description?: string;
    listDefaults?: Record<string, any>;
    taskDefaults?: Record<string, any>[];
  }): Promise<ListTemplate>;

  // ---- TRANSACTION SUPPORT ----
  
  /** Execute multiple operations in a transaction */
  transaction<T>(fn: (trx: IRepository) => Promise<T>): Promise<T>;
}

// ============================================================================
// Repository Factory Pattern
// ============================================================================

export type RepositoryConfig = {
  type: 'memory' | 'postgres' | 'mysql' | 'sqlite' | 'mongodb' | 'firebase';
  databaseUrl?: string;
  apiKey?: string;
  projectId?: string;
  [key: string]: any;
};

export interface IRepositoryFactory {
  createRepository(config: RepositoryConfig): Promise<IRepository>;
}

// ============================================================================
// Adapter Registry (for runtime selection)
// ============================================================================

export class RepositoryRegistry {
  private static adapters = new Map<string, IRepositoryFactory>();

  static register(type: string, factory: IRepositoryFactory): void {
    this.adapters.set(type, factory);
  }

  static async create(config: RepositoryConfig): Promise<IRepository> {
    const factory = this.adapters.get(config.type);
    if (!factory) {
      throw new Error(`Unknown repository type: ${config.type}`);
    }
    return factory.createRepository(config);
  }
}
