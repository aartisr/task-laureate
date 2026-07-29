/**
 * In-Memory Repository Adapter
 * 
 * Implements IRepository completely in-memory using JavaScript Maps.
 * Perfect for development, testing, and offline-first scenarios.
 * 
 * Data is cleared on every page refresh (no persistence).
 * For persistent in-memory state, use sessions or local storage.
 */

import {
  IRepository,
  IRepositoryFactory,
  RepositoryConfig,
  TodoItem,
  TodoList,
  ActivityEvent,
  ListTemplate,
  TaskStatus,
  ListStatus,
  Priority,
  ListFilters,
  TaskFilters,
  ActivityFilters,
} from './repository';

export class InMemoryRepositoryFactory implements IRepositoryFactory {
  async createRepository(_config: RepositoryConfig): Promise<IRepository> {
    return new InMemoryRepository();
  }
}

export class InMemoryRepository implements IRepository {
  private lists = new Map<string, any>();
  private tasks = new Map<string, any>();
  private activities: ActivityEvent[] = [];
  private templates = new Map<string, any>();
  private idCounter = 0;

  constructor() {
    // Initialize with seed data
    this.initializeSeedData();
  }

  // ============================================================================
  // Connection Lifecycle
  // ============================================================================

  async connect(): Promise<void> {
    // In-memory, no-op
  }

  async disconnect(): Promise<void> {
    // In-memory, no-op
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  // ============================================================================
  // LIST OPERATIONS
  // ============================================================================

  async listLists(filters?: ListFilters): Promise<TodoList[]> {
    let result = Array.from(this.lists.values());

    if (filters?.status) {
      result = result.filter((list) => list.status === filters.status);
    }
    if (filters?.excludeDeleted !== false) {
      result = result.filter((list) => !list.deletedAt);
    }
    if (filters?.excludeArchived) {
      result = result.filter((list) => list.status === 'ACTIVE');
    }

    return result.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getList(id: string): Promise<TodoList | null> {
    return this.lists.get(id) || null;
  }

  async createList(data: {
    title: string;
    description?: string;
    templateId?: string;
  }): Promise<TodoList> {
    const list: TodoList = {
      id: this.generateId('list'),
      title: data.title,
      description: data.description || '',
      status: 'ACTIVE',
      templateId: data.templateId || null,
      taskCount: 0,
      completedTaskCount: 0,
      completionPercent: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      archivedAt: null,
      deletedAt: null,
    };

    this.lists.set(list.id, list);
    await this.recordActivity({
      entityType: 'list',
      entityId: list.id,
      action: 'created',
      metadata: { title: list.title },
    });

    return list;
  }

  async updateList(id: string, data: Partial<TodoList>): Promise<TodoList> {
    const list = this.lists.get(id);
    if (!list) throw new Error(`List ${id} not found`);

    const updated = {
      ...list,
      title: data.title ?? list.title,
      description: data.description ?? list.description,
      status: data.status ?? list.status,
      updatedAt: new Date(),
    };

    this.lists.set(id, updated);
    await this.recordActivity({
      entityType: 'list',
      entityId: id,
      action: 'updated',
      metadata: data,
    });

    return updated;
  }

  async deleteList(id: string, hardDelete = false): Promise<void> {
    if (hardDelete) {
      this.lists.delete(id);
      // Also delete all tasks in this list
      for (const [taskId, task] of this.tasks) {
        if (task.listId === id) {
          this.tasks.delete(taskId);
        }
      }
    } else {
      const list = this.lists.get(id);
      if (list) {
        list.deletedAt = new Date();
        this.lists.set(id, list);
      }
    }

    await this.recordActivity({
      entityType: 'list',
      entityId: id,
      action: hardDelete ? 'deleted' : 'archived',
    });
  }

  // ============================================================================
  // TASK OPERATIONS
  // ============================================================================

  async listTasks(listId: string, filters?: TaskFilters): Promise<TodoItem[]> {
    let result = Array.from(this.tasks.values()).filter((t) => t.listId === listId);

    if (filters?.status) {
      result = result.filter((t) => t.status === filters.status);
    }
    if (filters?.priority) {
      result = result.filter((t) => t.priority === filters.priority);
    }
    if (filters?.tags && filters.tags.length > 0) {
      result = result.filter((t) => filters.tags!.some((tag) => t.tags.includes(tag)));
    }
    if (filters?.excludeDeleted !== false) {
      result = result.filter((t) => !t.deletedAt);
    }
    if (filters?.dueDate) {
      result = result.filter((t) => {
        if (!t.dueDate) return false;
        const dueDate = new Date(t.dueDate);
        if (filters.dueDate?.before && dueDate > filters.dueDate.before) return false;
        if (filters.dueDate?.after && dueDate < filters.dueDate.after) return false;
        return true;
      });
    }

    return result.sort((a, b) => a.order - b.order);
  }

  async getTask(id: string): Promise<TodoItem | null> {
    return this.tasks.get(id) || null;
  }

  async createTask(data: {
    listId: string;
    title: string;
    notes?: string;
    priority?: Priority;
    dueDate?: Date;
    tags?: string[];
  }): Promise<TodoItem> {
    // Get max order for this list
    const listTasks = Array.from(this.tasks.values()).filter(
      (t) => t.listId === data.listId && !t.deletedAt
    );
    const maxOrder = listTasks.length > 0 ? Math.max(...listTasks.map((t) => t.order)) : -1;

    const task: TodoItem = {
      id: this.generateId('task'),
      listId: data.listId,
      title: data.title,
      notes: data.notes || '',
      status: 'TODO',
      priority: data.priority || 'MEDIUM',
      dueDate: data.dueDate || null,
      tags: data.tags || [],
      order: maxOrder + 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: null,
      deletedAt: null,
    };

    this.tasks.set(task.id, task);
    await this.updateListCounts(data.listId);
    await this.recordActivity({
      entityType: 'task',
      entityId: task.id,
      action: 'created',
      metadata: { title: task.title, listId: data.listId },
    });

    return task;
  }

  async updateTask(id: string, data: Partial<TodoItem>): Promise<TodoItem> {
    const task = this.tasks.get(id);
    if (!task) throw new Error(`Task ${id} not found`);

    const updated = {
      ...task,
      title: data.title ?? task.title,
      notes: data.notes ?? task.notes,
      status: data.status ?? task.status,
      priority: data.priority ?? task.priority,
      dueDate: data.dueDate ?? task.dueDate,
      tags: data.tags ?? task.tags,
      updatedAt: new Date(),
    };

    this.tasks.set(id, updated);
    await this.updateListCounts(task.listId);
    await this.recordActivity({
      entityType: 'task',
      entityId: id,
      action: 'updated',
      metadata: data,
    });

    return updated;
  }

  async completeTask(id: string): Promise<TodoItem> {
    const task = this.tasks.get(id);
    if (!task) throw new Error(`Task ${id} not found`);

    const updated = {
      ...task,
      status: 'DONE' as TaskStatus,
      completedAt: new Date(),
      updatedAt: new Date(),
    };

    this.tasks.set(id, updated);
    await this.updateListCounts(task.listId);
    await this.recordActivity({
      entityType: 'task',
      entityId: id,
      action: 'completed',
      metadata: { status: 'DONE' },
    });

    return updated;
  }

  async deleteTask(id: string, hardDelete = false): Promise<void> {
    const task = this.tasks.get(id);
    if (!task) return;

    if (hardDelete) {
      this.tasks.delete(id);
    } else {
      task.deletedAt = new Date();
      this.tasks.set(id, task);
    }

    await this.updateListCounts(task.listId);
    await this.recordActivity({
      entityType: 'task',
      entityId: id,
      action: hardDelete ? 'deleted' : 'archived',
    });
  }

  async reorderTasks(
    listId: string,
    taskOrders: Array<{ id: string; order: number }>
  ): Promise<void> {
    for (const { id, order } of taskOrders) {
      const task = this.tasks.get(id);
      if (task) {
        task.order = order;
        this.tasks.set(id, task);
      }
    }
  }

  // ============================================================================
  // DASHBOARD OPERATIONS
  // ============================================================================

  async getDashboard(): Promise<{
    summary: {
      totalLists: number;
      totalTasks: number;
      completedTasks: number;
      overdueTasks: number;
    };
    lists: Array<TodoList & { tasks: TodoItem[] }>;
  }> {
    const activeLists = Array.from(this.lists.values()).filter(
      (l) => !l.deletedAt && l.status === 'ACTIVE'
    );

    const lists = activeLists
      .map((list) => ({
        ...list,
        tasks: Array.from(this.tasks.values())
          .filter((t) => t.listId === list.id && !t.deletedAt)
          .sort((a, b) => a.order - b.order),
      }))
      .sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

    const allTasks = Array.from(this.tasks.values()).filter((t) => !t.deletedAt);
    const completedTasks = allTasks.filter((t) => t.status === 'DONE').length;
    const now = new Date();
    const overdueTasks = allTasks.filter(
      (t) => t.dueDate && new Date(t.dueDate) < now && t.status !== 'DONE'
    ).length;

    return {
      summary: {
        totalLists: lists.length,
        totalTasks: allTasks.length,
        completedTasks,
        overdueTasks,
      },
      lists,
    };
  }

  // ============================================================================
  // SEARCH OPERATIONS
  // ============================================================================

  async searchTasks(query: string, filters?: TaskFilters): Promise<TodoItem[]> {
    const lowerQuery = query.toLowerCase();
    let result = Array.from(this.tasks.values()).filter(
      (t) =>
        !t.deletedAt &&
        (t.title.toLowerCase().includes(lowerQuery) ||
          t.notes.toLowerCase().includes(lowerQuery))
    );

    if (filters?.listId) {
      result = result.filter((t) => t.listId === filters.listId);
    }
    if (filters?.status) {
      result = result.filter((t) => t.status === filters.status);
    }

    return result.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async findTasks(filters: TaskFilters): Promise<TodoItem[]> {
    return this.listTasks(filters.listId || '', filters);
  }

  // ============================================================================
  // ACTIVITY / AUDIT OPERATIONS
  // ============================================================================

  async getActivity(filters?: ActivityFilters): Promise<ActivityEvent[]> {
    let result = [...this.activities];

    if (filters?.entityType) {
      result = result.filter((a) => a.entityType === filters.entityType);
    }
    if (filters?.entityId) {
      result = result.filter((a) => a.entityId === filters.entityId);
    }
    if (filters?.action) {
      result = result.filter((a) => a.action === filters.action);
    }
    if (filters?.timeRange) {
      result = result.filter(
        (a) =>
          a.timestamp >= filters.timeRange!.start &&
          a.timestamp <= filters.timeRange!.end
      );
    }

    result.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (filters?.limit) {
      result = result.slice(0, filters.limit);
    }

    return result;
  }

  async recordActivity(data: {
    entityType: 'list' | 'task';
    entityId: string;
    action: string;
    actor?: string;
    metadata?: Record<string, any>;
  }): Promise<ActivityEvent> {
    const event: ActivityEvent = {
      id: this.generateId('activity'),
      entityType: data.entityType,
      entityId: data.entityId,
      action: data.action,
      actor: data.actor || 'system',
      metadata: data.metadata || {},
      timestamp: new Date(),
      ...(data.entityType === 'list' && { listId: data.entityId }),
      ...(data.entityType === 'task' && { taskId: data.entityId }),
    };

    this.activities.push(event);
    return event;
  }

  // ============================================================================
  // TEMPLATE OPERATIONS
  // ============================================================================

  async listTemplates(): Promise<ListTemplate[]> {
    return Array.from(this.templates.values()).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }

  async getTemplate(id: string): Promise<ListTemplate | null> {
    return this.templates.get(id) || null;
  }

  async createTemplate(data: {
    title: string;
    description?: string;
    listDefaults?: Record<string, any>;
    taskDefaults?: Record<string, any>[];
  }): Promise<ListTemplate> {
    const template: ListTemplate = {
      id: this.generateId('template'),
      title: data.title,
      description: data.description || '',
      listDefaults: data.listDefaults || {},
      taskDefaults: data.taskDefaults || [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.templates.set(template.id, template);
    return template;
  }

  // ============================================================================
  // TRANSACTION SUPPORT
  // ============================================================================

  async transaction<T>(fn: (trx: IRepository) => Promise<T>): Promise<T> {
    // In-memory transactions are synchronous, just execute the function
    return fn(this);
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private async updateListCounts(listId: string): Promise<void> {
    const list = this.lists.get(listId);
    if (!list) return;

    const tasks = Array.from(this.tasks.values()).filter(
      (t) => t.listId === listId && !t.deletedAt
    );
    const completed = tasks.filter((t) => t.status === 'DONE').length;
    const total = tasks.length;

    list.taskCount = total;
    list.completedTaskCount = completed;
    list.completionPercent = total === 0 ? 0 : (completed / total) * 100;
    list.updatedAt = new Date();

    this.lists.set(listId, list);
  }

  private generateId(prefix: string): string {
    return `${prefix}_${this.idCounter++}_${Date.now()}`;
  }

  private initializeSeedData(): void {
    // Seed data for development
    const list1 = {
      id: 'list_launch',
      title: '🚀 Product Launch',
      description: 'Everything needed to ship the product',
      status: 'ACTIVE' as ListStatus,
      templateId: null,
      taskCount: 0,
      completedTaskCount: 0,
      completionPercent: 0,
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date('2024-01-15'),
      archivedAt: null,
      deletedAt: null,
    };

    const list2 = {
      id: 'list_ops',
      title: '⚙️ Operations',
      description: 'Ongoing operational tasks',
      status: 'ACTIVE' as ListStatus,
      templateId: null,
      taskCount: 0,
      completedTaskCount: 0,
      completionPercent: 0,
      createdAt: new Date('2024-02-01'),
      updatedAt: new Date('2024-02-01'),
      archivedAt: null,
      deletedAt: null,
    };

    this.lists.set(list1.id, list1);
    this.lists.set(list2.id, list2);

    const tasks = [
      {
        id: 'task_kickoff',
        listId: 'list_launch',
        title: 'Kickoff meeting',
        notes: 'Initial alignment with team',
        status: 'DONE' as TaskStatus,
        priority: 'HIGH' as Priority,
        dueDate: new Date('2024-01-16'),
        tags: ['meeting'],
        order: 0,
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-16'),
        completedAt: new Date('2024-01-16'),
        deletedAt: null,
      },
      {
        id: 'task_docs',
        listId: 'list_launch',
        title: 'Finalize documentation',
        notes: 'API docs, user guides, deployment',
        status: 'DOING' as TaskStatus,
        priority: 'HIGH' as Priority,
        dueDate: new Date('2024-01-20'),
        tags: ['documentation'],
        order: 1,
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-15'),
        completedAt: null,
        deletedAt: null,
      },
      {
        id: 'task_audit',
        listId: 'list_launch',
        title: 'Security audit',
        notes: 'OWASP top 10 review',
        status: 'TODO' as TaskStatus,
        priority: 'CRITICAL' as Priority,
        dueDate: new Date('2024-01-25'),
        tags: ['security'],
        order: 2,
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-15'),
        completedAt: null,
        deletedAt: null,
      },
      {
        id: 'task_metrics',
        listId: 'list_ops',
        title: 'Set up monitoring',
        notes: 'Configure dashboards and alerts',
        status: 'TODO' as TaskStatus,
        priority: 'MEDIUM' as Priority,
        dueDate: null,
        tags: ['monitoring'],
        order: 0,
        createdAt: new Date('2024-02-01'),
        updatedAt: new Date('2024-02-01'),
        completedAt: null,
        deletedAt: null,
      },
    ];

    tasks.forEach((task) => this.tasks.set(task.id, task));

    // Update list counts
    this.updateListCounts('list_launch');
    this.updateListCounts('list_ops');

    // Add seed activities
    this.activities.push({
      id: 'activity_1',
      entityType: 'list',
      entityId: 'list_launch',
      action: 'created',
      actor: 'system',
      metadata: { title: 'Product Launch' },
      timestamp: new Date('2024-01-15'),
    });

    this.activities.push({
      id: 'activity_2',
      entityType: 'task',
      entityId: 'task_kickoff',
      action: 'completed',
      actor: 'system',
      metadata: { status: 'DONE' },
      timestamp: new Date('2024-01-16'),
    });

    // Add seed template
    this.templates.set('template_starter', {
      id: 'template_starter',
      title: 'Starter Template',
      description: 'Basic template to get started',
      listDefaults: { status: 'ACTIVE' },
      taskDefaults: [
        { title: 'Planning', priority: 'HIGH' },
        { title: 'Execution', priority: 'MEDIUM' },
        { title: 'Review', priority: 'MEDIUM' },
      ],
      createdAt: new Date('2024-01-10'),
      updatedAt: new Date('2024-01-10'),
    });
  }
}
