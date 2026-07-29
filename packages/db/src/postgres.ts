/**
 * PostgreSQL Repository Adapter
 * 
 * Implements IRepository for PostgreSQL using Prisma ORM.
 * Can be swapped with other adapters (MySQL, MongoDB, Firebase) without changing app code.
 */

import { PrismaClient } from '@prisma/client';
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

export class PostgresRepositoryFactory implements IRepositoryFactory {
  async createRepository(config: RepositoryConfig): Promise<IRepository> {
    const databaseUrl = config.databaseUrl || process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL not provided and not set in environment');
    }

    return new PostgresRepository(databaseUrl);
  }
}

export class PostgresRepository implements IRepository {
  private prisma: PrismaClient;
  private isConnected = false;

  constructor(databaseUrl: string) {
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
      // Enable connection pooling for serverless (via Vercel Postgres or PgBouncer)
      log: process.env.DEBUG ? ['query', 'error', 'warn'] : ['error'],
    });
  }

  // ============================================================================
  // Connection Lifecycle
  // ============================================================================

  async connect(): Promise<void> {
    if (this.isConnected) return;
    await this.prisma.$connect();
    this.isConnected = true;
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected) return;
    await this.prisma.$disconnect();
    this.isConnected = false;
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  // ============================================================================
  // LIST OPERATIONS
  // ============================================================================

  async listLists(filters?: ListFilters): Promise<TodoList[]> {
    const where: any = {};

    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.excludeDeleted !== false) {
      where.deletedAt = null;
    }
    if (filters?.excludeArchived) {
      where.status = 'ACTIVE';
    }

    const lists = await this.prisma.todoList.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return lists.map(this.mapTodoList);
  }

  async getList(id: string): Promise<TodoList | null> {
    const list = await this.prisma.todoList.findUnique({
      where: { id },
    });
    return list ? this.mapTodoList(list) : null;
  }

  async createList(data: {
    title: string;
    description?: string;
    templateId?: string;
  }): Promise<TodoList> {
    const list = await this.prisma.todoList.create({
      data: {
        title: data.title,
        description: data.description || '',
        templateId: data.templateId,
        taskCount: 0,
        completedTaskCount: 0,
        completionPercent: 0,
      },
    });

    await this.recordActivity({
      entityType: 'list',
      entityId: list.id,
      action: 'created',
      metadata: { title: list.title },
    });

    return this.mapTodoList(list);
  }

  async updateList(id: string, data: Partial<TodoList>): Promise<TodoList> {
    const list = await this.prisma.todoList.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        status: data.status as ListStatus,
      },
    });

    await this.recordActivity({
      entityType: 'list',
      entityId: id,
      action: 'updated',
      metadata: data,
    });

    return this.mapTodoList(list);
  }

  async deleteList(id: string, hardDelete = false): Promise<void> {
    if (hardDelete) {
      await this.prisma.todoList.delete({ where: { id } });
    } else {
      await this.prisma.todoList.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
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
    const where: any = { listId };

    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.priority) {
      where.priority = filters.priority;
    }
    if (filters?.tags && filters.tags.length > 0) {
      where.tags = { hasSome: filters.tags };
    }
    if (filters?.excludeDeleted !== false) {
      where.deletedAt = null;
    }
    if (filters?.dueDate) {
      where.dueDate = {};
      if (filters.dueDate.before) {
        where.dueDate.lte = filters.dueDate.before;
      }
      if (filters.dueDate.after) {
        where.dueDate.gte = filters.dueDate.after;
      }
    }

    const tasks = await this.prisma.todoItem.findMany({
      where,
      orderBy: { order: 'asc' },
    });

    return tasks.map(this.mapTodoItem);
  }

  async getTask(id: string): Promise<TodoItem | null> {
    const task = await this.prisma.todoItem.findUnique({
      where: { id },
    });
    return task ? this.mapTodoItem(task) : null;
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
    const maxOrder = await this.prisma.todoItem.aggregate({
      where: { listId: data.listId, deletedAt: null },
      _max: { order: true },
    });

    const task = await this.prisma.todoItem.create({
      data: {
        listId: data.listId,
        title: data.title,
        notes: data.notes || '',
        priority: data.priority || 'MEDIUM',
        dueDate: data.dueDate,
        tags: data.tags || [],
        order: (maxOrder._max.order ?? -1) + 1,
      },
    });

    // Update list task count
    await this.updateListCounts(data.listId);

    await this.recordActivity({
      entityType: 'task',
      entityId: task.id,
      action: 'created',
      metadata: { title: task.title, listId: data.listId },
    });

    return this.mapTodoItem(task);
  }

  async updateTask(id: string, data: Partial<TodoItem>): Promise<TodoItem> {
    const task = await this.prisma.todoItem.update({
      where: { id },
      data: {
        title: data.title,
        notes: data.notes,
        status: data.status as TaskStatus,
        priority: data.priority as Priority,
        dueDate: data.dueDate,
        tags: data.tags,
      },
    });

    // Update parent list counts
    await this.updateListCounts(task.listId);

    await this.recordActivity({
      entityType: 'task',
      entityId: id,
      action: 'updated',
      metadata: data,
    });

    return this.mapTodoItem(task);
  }

  async completeTask(id: string): Promise<TodoItem> {
    const task = await this.prisma.todoItem.update({
      where: { id },
      data: {
        status: 'DONE',
        completedAt: new Date(),
      },
    });

    // Update parent list counts
    await this.updateListCounts(task.listId);

    await this.recordActivity({
      entityType: 'task',
      entityId: id,
      action: 'completed',
      metadata: { status: 'DONE' },
    });

    return this.mapTodoItem(task);
  }

  async deleteTask(id: string, hardDelete = false): Promise<void> {
    const task = await this.prisma.todoItem.findUnique({
      where: { id },
      select: { listId: true },
    });

    if (!task) return;

    if (hardDelete) {
      await this.prisma.todoItem.delete({ where: { id } });
    } else {
      await this.prisma.todoItem.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    }

    // Update parent list counts
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
    await Promise.all(
      taskOrders.map((item) =>
        this.prisma.todoItem.update({
          where: { id: item.id },
          data: { order: item.order },
        })
      )
    );
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
    const [lists, totalTasks, completedTasks, overdueTasks] = await Promise.all([
      this.prisma.todoList.findMany({
        where: { deletedAt: null, status: 'ACTIVE' },
        include: { tasks: { where: { deletedAt: null } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.todoItem.count({
        where: { deletedAt: null },
      }),
      this.prisma.todoItem.count({
        where: { deletedAt: null, status: 'DONE' },
      }),
      this.prisma.todoItem.count({
        where: {
          deletedAt: null,
          dueDate: { lt: new Date() },
          status: { not: 'DONE' },
        },
      }),
    ]);

    return {
      summary: {
        totalLists: lists.length,
        totalTasks,
        completedTasks,
        overdueTasks,
      },
      lists: lists.map((list) => ({
        ...this.mapTodoList(list),
        tasks: list.tasks.map(this.mapTodoItem),
      })),
    };
  }

  // ============================================================================
  // SEARCH OPERATIONS
  // ============================================================================

  async searchTasks(query: string, filters?: TaskFilters): Promise<TodoItem[]> {
    const where: any = {
      deletedAt: null,
      OR: [
        { title: { search: query, mode: 'insensitive' } },
        { notes: { search: query, mode: 'insensitive' } },
      ],
    };

    if (filters?.listId) {
      where.listId = filters.listId;
    }
    if (filters?.status) {
      where.status = filters.status;
    }

    const tasks = await this.prisma.todoItem.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return tasks.map(this.mapTodoItem);
  }

  async findTasks(filters: TaskFilters): Promise<TodoItem[]> {
    return this.listTasks(filters.listId || '', filters);
  }

  // ============================================================================
  // ACTIVITY / AUDIT OPERATIONS
  // ============================================================================

  async getActivity(filters?: ActivityFilters): Promise<ActivityEvent[]> {
    const where: any = {};

    if (filters?.entityType) {
      where.entityType = filters.entityType;
    }
    if (filters?.entityId) {
      where.entityId = filters.entityId;
    }
    if (filters?.action) {
      where.action = filters.action;
    }
    if (filters?.timeRange) {
      where.timestamp = {
        gte: filters.timeRange.start,
        lte: filters.timeRange.end,
      };
    }

    const events = await this.prisma.activityEvent.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: filters?.limit || 100,
    });

    return events.map(this.mapActivityEvent);
  }

  async recordActivity(data: {
    entityType: 'list' | 'task';
    entityId: string;
    action: string;
    actor?: string;
    metadata?: Record<string, any>;
  }): Promise<ActivityEvent> {
    const event = await this.prisma.activityEvent.create({
      data: {
        entityType: data.entityType,
        entityId: data.entityId,
        action: data.action,
        actor: data.actor || 'system',
        metadata: data.metadata || {},
        ...(data.entityType === 'list' && { listId: data.entityId }),
        ...(data.entityType === 'task' && { taskId: data.entityId }),
      },
    });

    return this.mapActivityEvent(event);
  }

  // ============================================================================
  // TEMPLATE OPERATIONS
  // ============================================================================

  async listTemplates(): Promise<ListTemplate[]> {
    const templates = await this.prisma.listTemplate.findMany({
      orderBy: { createdAt: 'asc' },
    });
    return templates.map(this.mapListTemplate);
  }

  async getTemplate(id: string): Promise<ListTemplate | null> {
    const template = await this.prisma.listTemplate.findUnique({
      where: { id },
    });
    return template ? this.mapListTemplate(template) : null;
  }

  async createTemplate(data: {
    title: string;
    description?: string;
    listDefaults?: Record<string, any>;
    taskDefaults?: Record<string, any>[];
  }): Promise<ListTemplate> {
    const template = await this.prisma.listTemplate.create({
      data: {
        title: data.title,
        description: data.description || '',
        listDefaults: data.listDefaults || {},
        taskDefaults: data.taskDefaults || [],
      },
    });

    return this.mapListTemplate(template);
  }

  // ============================================================================
  // TRANSACTION SUPPORT
  // ============================================================================

  async transaction<T>(fn: (trx: IRepository) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async () => fn(this));
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private async updateListCounts(listId: string): Promise<void> {
    const counts = await this.prisma.todoItem.aggregate({
      where: { listId, deletedAt: null },
      _count: true,
    });

    const completed = await this.prisma.todoItem.count({
      where: { listId, deletedAt: null, status: 'DONE' },
    });

    const total = counts._count;
    const percent = total === 0 ? 0 : (completed / total) * 100;

    await this.prisma.todoList.update({
      where: { id: listId },
      data: {
        taskCount: total,
        completedTaskCount: completed,
        completionPercent: parseFloat(percent.toFixed(1)),
      },
    });
  }

  private mapTodoList(list: any): TodoList {
    return {
      id: list.id,
      title: list.title,
      description: list.description,
      status: list.status,
      templateId: list.templateId,
      taskCount: list.taskCount,
      completedTaskCount: list.completedTaskCount,
      completionPercent: list.completionPercent,
      createdAt: list.createdAt,
      updatedAt: list.updatedAt,
      archivedAt: list.archivedAt,
      deletedAt: list.deletedAt,
    };
  }

  private mapTodoItem(item: any): TodoItem {
    return {
      id: item.id,
      listId: item.listId,
      title: item.title,
      notes: item.notes,
      status: item.status,
      priority: item.priority,
      dueDate: item.dueDate,
      tags: item.tags,
      order: item.order,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      completedAt: item.completedAt,
      deletedAt: item.deletedAt,
    };
  }

  private mapActivityEvent(event: any): ActivityEvent {
    return {
      id: event.id,
      entityType: event.entityType,
      entityId: event.entityId,
      action: event.action,
      actor: event.actor,
      metadata: event.metadata,
      timestamp: event.timestamp,
      listId: event.listId,
      taskId: event.taskId,
    };
  }

  private mapListTemplate(template: any): ListTemplate {
    return {
      id: template.id,
      title: template.title,
      description: template.description,
      listDefaults: template.listDefaults,
      taskDefaults: template.taskDefaults,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    };
  }
}
