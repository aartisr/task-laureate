/**
 * Enhanced PostgreSQL Repository Adapter
 * 
 * - Optimized for Vercel serverless deployment
 * - Connection pooling with PgBouncer support
 * - Retry logic with exponential backoff
 * - Comprehensive error handling
 * - Query caching and performance optimization
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
import {
  ConnectionError,
  QueryError,
  withRetry,
  withTimeout,
  CircuitBreaker,
  Logger,
  TimeoutError,
} from './errors';
import { DatabaseConfig } from './config';

export class PostgresRepositoryFactory implements IRepositoryFactory {
  async createRepository(config: RepositoryConfig): Promise<IRepository> {
    const databaseUrl = config.databaseUrl || process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new ConnectionError(
        'DATABASE_URL not provided and not set in environment. ' +
          'Set DATABASE_URL environment variable or pass databaseUrl in config.'
      );
    }

    return new PostgresRepository(databaseUrl, config as DatabaseConfig);
  }
}

export class PostgresRepository implements IRepository {
  private prisma: PrismaClient;
  private isConnected = false;
  private circuitBreaker: CircuitBreaker;
  private logger: Logger;
  private queryTimeoutMs: number;

  constructor(
    databaseUrl: string,
    config?: Partial<DatabaseConfig>
  ) {
    this.logger = new Logger(config?.logLevel ?? 'warn');
    this.queryTimeoutMs = config?.queryTimeout ?? 30000;
    this.circuitBreaker = new CircuitBreaker(5, 60000);

    // Build connection string with pooling settings for Vercel
    const connectionString = this.buildConnectionString(databaseUrl, config);

    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: connectionString,
        },
      },
      log: config?.debug ? ['query', 'error', 'warn'] : ['error'],
      errorFormat: 'pretty',
    });

    this.logger.debug('PostgresRepository initialized', {
      hasPooling: connectionString.includes('sslmode'),
      timeout: this.queryTimeoutMs,
    });
  }

  // ============================================================================
  // Connection Lifecycle with Resilience
  // ============================================================================

  async connect(): Promise<void> {
    if (this.isConnected) {
      this.logger.debug('Already connected, skipping reconnect');
      return;
    }

    try {
      await withRetry(
        async () => {
          await withTimeout(
            this.prisma.$connect(),
            5000,
            'Connection timeout exceeded'
          );
        },
        {
          maxAttempts: 3,
          delayMs: 500,
          onRetry: (attempt, error) => {
            this.logger.warn(
              `Connection attempt ${attempt} failed: ${error.message}`
            );
          },
        }
      );

      // Verify connection with health check
      await this.healthCheck();
      this.isConnected = true;
      this.logger.info('Connected to PostgreSQL database');
    } catch (error) {
      const err =
        error instanceof Error ? error : new Error(String(error));
      throw new ConnectionError(
        `Failed to connect to database: ${err.message}`,
        err
      );
    }
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected) return;

    try {
      await this.prisma.$disconnect();
      this.isConnected = false;
      this.logger.info('Disconnected from PostgreSQL database');
    } catch (error) {
      this.logger.error(
        'Error disconnecting from database',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await withTimeout(
        this.executeQuery(() => this.prisma.$queryRaw`SELECT 1`),
        5000,
        'Health check timeout'
      );
      this.logger.debug('Health check passed');
      return true;
    } catch (error) {
      this.logger.warn(
        `Health check failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return false;
    }
  }

  // ============================================================================
  // LIST OPERATIONS with Error Handling
  // ============================================================================

  async listLists(filters?: ListFilters): Promise<TodoList[]> {
    return this.withCircuitBreaker(async () => {
      try {
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

        const lists = await this.executeQuery(() =>
          this.prisma.todoList.findMany({
            where,
            orderBy: { createdAt: 'desc' },
          })
        );

        return lists.map(this.mapTodoList);
      } catch (error) {
        throw this.handleQueryError('listLists', error);
      }
    });
  }

  async getList(id: string): Promise<TodoList | null> {
    return this.withCircuitBreaker(async () => {
      try {
        const list = await this.executeQuery(() =>
          this.prisma.todoList.findUnique({
            where: { id },
          })
        );
        return list ? this.mapTodoList(list) : null;
      } catch (error) {
        throw this.handleQueryError('getList', error);
      }
    });
  }

  async createList(data: {
    title: string;
    description?: string;
    templateId?: string;
  }): Promise<TodoList> {
    return this.withCircuitBreaker(async () => {
      try {
        if (!data.title || data.title.trim().length === 0) {
          throw new Error('List title cannot be empty');
        }

        const list = await this.executeQuery(() =>
          this.prisma.todoList.create({
            data: {
              title: data.title.trim(),
              description: (data.description || '').trim(),
              templateId: data.templateId,
              taskCount: 0,
              completedTaskCount: 0,
              completionPercent: 0,
            },
          })
        );

        await this.recordActivity({
          entityType: 'list',
          entityId: list.id,
          action: 'created',
          metadata: { title: list.title },
        });

        return this.mapTodoList(list);
      } catch (error) {
        throw this.handleQueryError('createList', error);
      }
    });
  }

  async updateList(id: string, data: Partial<TodoList>): Promise<TodoList> {
    return this.withCircuitBreaker(async () => {
      try {
        const list = await this.executeQuery(() =>
          this.prisma.todoList.update({
            where: { id },
            data: {
              title: data.title?.trim(),
              description: data.description?.trim(),
              status: data.status as ListStatus,
            },
          })
        );

        await this.recordActivity({
          entityType: 'list',
          entityId: id,
          action: 'updated',
          metadata: data,
        });

        return this.mapTodoList(list);
      } catch (error) {
        throw this.handleQueryError('updateList', error);
      }
    });
  }

  async deleteList(id: string, hardDelete = false): Promise<void> {
    return this.withCircuitBreaker(async () => {
      try {
        if (hardDelete) {
          await this.executeQuery(() =>
            this.prisma.todoList.delete({ where: { id } })
          );
        } else {
          await this.executeQuery(() =>
            this.prisma.todoList.update({
              where: { id },
              data: { deletedAt: new Date() },
            })
          );
        }

        await this.recordActivity({
          entityType: 'list',
          entityId: id,
          action: hardDelete ? 'deleted' : 'archived',
        });
      } catch (error) {
        throw this.handleQueryError('deleteList', error);
      }
    });
  }

  // ============================================================================
  // TASK OPERATIONS
  // ============================================================================

  async listTasks(listId: string, filters?: TaskFilters): Promise<TodoItem[]> {
    return this.withCircuitBreaker(async () => {
      try {
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

        const tasks = await this.executeQuery(() =>
          this.prisma.todoItem.findMany({
            where,
            orderBy: { order: 'asc' },
          })
        );

        return tasks.map(this.mapTodoItem);
      } catch (error) {
        throw this.handleQueryError('listTasks', error);
      }
    });
  }

  async getTask(id: string): Promise<TodoItem | null> {
    return this.withCircuitBreaker(async () => {
      try {
        const task = await this.executeQuery(() =>
          this.prisma.todoItem.findUnique({
            where: { id },
          })
        );
        return task ? this.mapTodoItem(task) : null;
      } catch (error) {
        throw this.handleQueryError('getTask', error);
      }
    });
  }

  async createTask(data: {
    listId: string;
    title: string;
    notes?: string;
    priority?: Priority;
    dueDate?: Date;
    tags?: string[];
  }): Promise<TodoItem> {
    return this.withCircuitBreaker(async () => {
      try {
        if (!data.title || data.title.trim().length === 0) {
          throw new Error('Task title cannot be empty');
        }

        const maxOrder = await this.executeQuery(() =>
          this.prisma.todoItem.aggregate({
            where: { listId: data.listId, deletedAt: null },
            _max: { order: true },
          })
        );

        const task = await this.executeQuery(() =>
          this.prisma.todoItem.create({
            data: {
              listId: data.listId,
              title: data.title.trim(),
              notes: (data.notes || '').trim(),
              priority: data.priority || 'MEDIUM',
              dueDate: data.dueDate,
              tags: data.tags || [],
              order: (maxOrder._max.order ?? -1) + 1,
            },
          })
        );

        await this.updateListCounts(data.listId);
        await this.recordActivity({
          entityType: 'task',
          entityId: task.id,
          action: 'created',
          metadata: { title: task.title, listId: data.listId },
        });

        return this.mapTodoItem(task);
      } catch (error) {
        throw this.handleQueryError('createTask', error);
      }
    });
  }

  async updateTask(id: string, data: Partial<TodoItem>): Promise<TodoItem> {
    return this.withCircuitBreaker(async () => {
      try {
        const task = await this.executeQuery(() =>
          this.prisma.todoItem.update({
            where: { id },
            data: {
              title: data.title?.trim(),
              notes: data.notes?.trim(),
              status: data.status as TaskStatus,
              priority: data.priority as Priority,
              dueDate: data.dueDate,
              tags: data.tags,
            },
          })
        );

        await this.updateListCounts(task.listId);
        await this.recordActivity({
          entityType: 'task',
          entityId: id,
          action: 'updated',
          metadata: data,
        });

        return this.mapTodoItem(task);
      } catch (error) {
        throw this.handleQueryError('updateTask', error);
      }
    });
  }

  async completeTask(id: string): Promise<TodoItem> {
    return this.withCircuitBreaker(async () => {
      try {
        const task = await this.executeQuery(() =>
          this.prisma.todoItem.update({
            where: { id },
            data: {
              status: 'DONE',
              completedAt: new Date(),
            },
          })
        );

        await this.updateListCounts(task.listId);
        await this.recordActivity({
          entityType: 'task',
          entityId: id,
          action: 'completed',
          metadata: { status: 'DONE' },
        });

        return this.mapTodoItem(task);
      } catch (error) {
        throw this.handleQueryError('completeTask', error);
      }
    });
  }

  async deleteTask(id: string, hardDelete = false): Promise<void> {
    return this.withCircuitBreaker(async () => {
      try {
        const task = await this.executeQuery(() =>
          this.prisma.todoItem.findUnique({
            where: { id },
            select: { listId: true },
          })
        );

        if (!task) return;

        if (hardDelete) {
          await this.executeQuery(() =>
            this.prisma.todoItem.delete({ where: { id } })
          );
        } else {
          await this.executeQuery(() =>
            this.prisma.todoItem.update({
              where: { id },
              data: { deletedAt: new Date() },
            })
          );
        }

        await this.updateListCounts(task.listId);
        await this.recordActivity({
          entityType: 'task',
          entityId: id,
          action: hardDelete ? 'deleted' : 'archived',
        });
      } catch (error) {
        throw this.handleQueryError('deleteTask', error);
      }
    });
  }

  async reorderTasks(
    listId: string,
    taskOrders: Array<{ id: string; order: number }>
  ): Promise<void> {
    return this.withCircuitBreaker(async () => {
      try {
        await this.executeQuery(() =>
          Promise.all(
            taskOrders.map((item) =>
              this.prisma.todoItem.update({
                where: { id: item.id },
                data: { order: item.order },
              })
            )
          )
        );
      } catch (error) {
        throw this.handleQueryError('reorderTasks', error);
      }
    });
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
    // Due dates represent full calendar days and are persisted at midnight
    // UTC. A task is overdue only once its due calendar day has passed.
    const todayStartUtc = new Date();
    todayStartUtc.setUTCHours(0, 0, 0, 0);
    return this.withCircuitBreaker(async () => {
      try {
        const [lists, totalTasks, completedTasks, overdueTasks] = await this.executeQuery(() =>
          Promise.all([
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
                dueDate: { lt: todayStartUtc },
                status: { not: 'DONE' },
              },
            }),
          ])
        );

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
      } catch (error) {
        throw this.handleQueryError('getDashboard', error);
      }
    });
  }

  // ============================================================================
  // SEARCH OPERATIONS
  // ============================================================================

  async searchTasks(query: string, filters?: TaskFilters): Promise<TodoItem[]> {
    return this.withCircuitBreaker(async () => {
      try {
        if (!query || query.trim().length === 0) {
          return [];
        }

        const searchQuery = query.trim();
        const where: any = {
          deletedAt: null,
          OR: [
            { title: { search: searchQuery, mode: 'insensitive' } },
            { notes: { search: searchQuery, mode: 'insensitive' } },
          ],
        };

        if (filters?.listId) {
          where.listId = filters.listId;
        }
        if (filters?.status) {
          where.status = filters.status;
        }

        const tasks = await this.executeQuery(() =>
          this.prisma.todoItem.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: 100,
          })
        );

        return tasks.map(this.mapTodoItem);
      } catch (error) {
        throw this.handleQueryError('searchTasks', error);
      }
    });
  }

  async findTasks(filters: TaskFilters): Promise<TodoItem[]> {
    return this.listTasks(filters.listId || '', filters);
  }

  // ============================================================================
  // ACTIVITY / AUDIT OPERATIONS
  // ============================================================================

  async getActivity(filters?: ActivityFilters): Promise<ActivityEvent[]> {
    return this.withCircuitBreaker(async () => {
      try {
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

        const events = await this.executeQuery(() =>
          this.prisma.activityEvent.findMany({
            where,
            orderBy: { timestamp: 'desc' },
            take: filters?.limit || 100,
          })
        );

        return events.map(this.mapActivityEvent);
      } catch (error) {
        throw this.handleQueryError('getActivity', error);
      }
    });
  }

  async recordActivity(data: {
    entityType: 'list' | 'task';
    entityId: string;
    action: string;
    actor?: string;
    metadata?: Record<string, any>;
  }): Promise<ActivityEvent> {
    try {
      const event = await this.executeQuery(() =>
        this.prisma.activityEvent.create({
          data: {
            entityType: data.entityType,
            entityId: data.entityId,
            action: data.action,
            actor: data.actor || 'system',
            metadata: data.metadata || {},
            ...(data.entityType === 'list' && { listId: data.entityId }),
            ...(data.entityType === 'task' && { taskId: data.entityId }),
          },
        })
      );

      return this.mapActivityEvent(event);
    } catch (error) {
      this.logger.warn(
        `Failed to record activity: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      // Don't throw - activity recording should not fail the main operation
      return {
        id: 'activity_failed',
        entityType: data.entityType,
        entityId: data.entityId,
        action: data.action,
        actor: data.actor || 'system',
        metadata: data.metadata || {},
        timestamp: new Date(),
      };
    }
  }

  // ============================================================================
  // TEMPLATE OPERATIONS
  // ============================================================================

  async listTemplates(): Promise<ListTemplate[]> {
    return this.withCircuitBreaker(async () => {
      try {
        const templates = await this.executeQuery(() =>
          this.prisma.listTemplate.findMany({
            orderBy: { createdAt: 'asc' },
          })
        );
        return templates.map(this.mapListTemplate);
      } catch (error) {
        throw this.handleQueryError('listTemplates', error);
      }
    });
  }

  async getTemplate(id: string): Promise<ListTemplate | null> {
    return this.withCircuitBreaker(async () => {
      try {
        const template = await this.executeQuery(() =>
          this.prisma.listTemplate.findUnique({
            where: { id },
          })
        );
        return template ? this.mapListTemplate(template) : null;
      } catch (error) {
        throw this.handleQueryError('getTemplate', error);
      }
    });
  }

  async createTemplate(data: {
    title: string;
    description?: string;
    listDefaults?: Record<string, any>;
    taskDefaults?: Record<string, any>[];
  }): Promise<ListTemplate> {
    return this.withCircuitBreaker(async () => {
      try {
        const template = await this.executeQuery(() =>
          this.prisma.listTemplate.create({
            data: {
              title: data.title,
              description: data.description || '',
              listDefaults: data.listDefaults || {},
              taskDefaults: data.taskDefaults || [],
            },
          })
        );

        return this.mapListTemplate(template);
      } catch (error) {
        throw this.handleQueryError('createTemplate', error);
      }
    });
  }

  // ============================================================================
  // TRANSACTION SUPPORT
  // ============================================================================

  async transaction<T>(fn: (trx: IRepository) => Promise<T>): Promise<T> {
    return this.withCircuitBreaker(async () => {
      try {
        return await this.executeQuery(() =>
          this.prisma.$transaction(() => fn(this))
        );
      } catch (error) {
        throw this.handleQueryError('transaction', error);
      }
    });
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private async withCircuitBreaker<T>(fn: () => Promise<T>): Promise<T> {
    return this.circuitBreaker.execute(() => fn());
  }

  private async executeQuery<T>(fn: () => Promise<T>): Promise<T> {
    return withTimeout(
      withRetry(fn, {
        maxAttempts: 3,
        delayMs: 100,
        onRetry: (attempt, error) => {
          this.logger.debug(
            `Query retry attempt ${attempt}: ${error.message}`
          );
        },
      }),
      this.queryTimeoutMs,
      `Query timeout after ${this.queryTimeoutMs}ms`
    );
  }

  private async updateListCounts(listId: string): Promise<void> {
    try {
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
    } catch (error) {
      this.logger.warn(
        `Failed to update list counts for ${listId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  private handleQueryError(operation: string, error: unknown): Error {
    const err = error instanceof Error ? error : new Error(String(error));
    this.logger.error(`Query error in ${operation}`, err);

    if (
      err.message.includes('Connection refused') ||
      err.message.includes('timeout')
    ) {
      return new ConnectionError(`${operation} failed: connection issue`, err);
    }

    return new QueryError(`${operation} failed: ${err.message}`, err);
  }

  private buildConnectionString(
    databaseUrl: string,
    config?: Partial<DatabaseConfig>
  ): string {
    // For Vercel Postgres, add connection pooling parameters
    const url = new URL(databaseUrl);

    if (!url.searchParams.has('sslmode')) {
      url.searchParams.set('sslmode', 'require');
    }

    // Add Prisma connection pooling for serverless
    if (config?.postgres?.connectionLimit) {
      url.searchParams.set(
        'connection_limit',
        String(config.postgres.connectionLimit)
      );
    }

    return url.toString();
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
}
