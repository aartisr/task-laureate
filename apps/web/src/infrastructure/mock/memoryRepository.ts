import type {
  ActivityEvent,
  DashboardSummary,
  ListTemplate,
  SearchResult,
  TodoItem,
  TodoList,
} from '../../core/contracts/domain';
import type {
  SearchInput,
  TodoListInput,
  TodoListUpdateInput,
  TodoRepository,
  TodoTaskInput,
  TodoTaskUpdateInput,
} from '../../core/contracts/repository';
import { computeDashboardSummary, computeListCompletion, getVisibleTasks, sortTasksByOrder } from '../../core/domain/logic';
import { createId } from '../../core/utils/ids';
import type { WorkspaceData } from '../persistence/workspace';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function nowIso() {
  return new Date().toISOString();
}

export interface WorkspaceRepository extends TodoRepository {
  exportWorkspace(): Promise<WorkspaceData>;
  importWorkspace(workspace: WorkspaceData): Promise<void>;
}

export function createMemoryTodoRepository(seed: WorkspaceData, options: { onChange?: (workspace: WorkspaceData) => void } = {}): WorkspaceRepository {
  const lists = new Map(seed.lists.map((list) => [list.id, clone(list)] as const));
  const tasks = new Map(seed.tasks.map((task) => [task.id, clone(task)] as const));
  const activity = [...seed.activity.map((event) => clone(event))];
  const templates = [...seed.templates.map((template) => clone(template))];

  const appendEvent = (event: ActivityEvent) => {
    activity.unshift(clone(event));
  };

  const recalculateList = (listId: string) => {
    const list = lists.get(listId);
    if (!list) {
      return null;
    }

    const listTasks = sortTasksByOrder([...tasks.values()].filter((task) => task.listId === listId));
    list.taskCount = listTasks.filter((task) => task.deletedAt === null).length;
    list.completedTaskCount = listTasks.filter((task) => task.status === 'done' && task.deletedAt === null).length;
    list.completionPercent = computeListCompletion(listTasks);
    list.updatedAt = nowIso();
    return list;
  };

  const findTaskById = (taskId: string) => tasks.get(taskId) ?? null;

  const exportWorkspace = (): WorkspaceData => ({
    lists: [...lists.values()].map(clone), tasks: [...tasks.values()].map(clone),
    activity: clone(activity), templates: clone(templates),
  });

  const repository: WorkspaceRepository = {
    async getDashboard() {
      const allLists = [...lists.values()];
      const allTasks = [...tasks.values()];
      return {
        summary: computeDashboardSummary(allLists, allTasks),
        lists: allLists.filter((list) => list.deletedAt === null).map(clone),
      };
    },

    async listLists() {
      return [...lists.values()].filter((list) => list.deletedAt === null).map(clone);
    },

    async getList(listId) {
      const list = lists.get(listId);
      return list ? clone(list) : null;
    },

    async createList(input: TodoListInput) {
      const timestamp = nowIso();
      const list: TodoList = {
        id: createId('list'),
        title: input.title.trim(),
        description: input.description?.trim() ?? '',
        status: 'active',
        templateId: input.templateId ?? null,
        createdAt: timestamp,
        updatedAt: timestamp,
        archivedAt: null,
        deletedAt: null,
        completionPercent: 0,
        taskCount: 0,
        completedTaskCount: 0,
      };
      lists.set(list.id, list);
      appendEvent({
        id: createId('event'),
        entityType: 'list',
        entityId: list.id,
        action: 'created',
        actor: 'system',
        timestamp,
        metadata: { title: list.title },
      });
      return clone(list);
    },

    async updateList(listId, input: TodoListUpdateInput) {
      const list = lists.get(listId);
      if (!list) {
        throw new Error(`List not found: ${listId}`);
      }

      if (typeof input.title === 'string') {
        list.title = input.title.trim();
      }
      if (typeof input.description === 'string') {
        list.description = input.description.trim();
      }
      if (input.status) {
        list.status = input.status;
      }
      list.updatedAt = nowIso();
      appendEvent({
        id: createId('event'),
        entityType: 'list',
        entityId: list.id,
        action: 'updated',
        actor: 'system',
        timestamp: list.updatedAt,
        metadata: {},
      });
      return clone(list);
    },

    async archiveList(listId) {
      const list = lists.get(listId);
      if (!list) {
        throw new Error(`List not found: ${listId}`);
      }
      list.status = 'archived';
      list.archivedAt = nowIso();
      list.deletedAt = list.archivedAt;
      list.updatedAt = list.archivedAt;
      appendEvent({
        id: createId('event'),
        entityType: 'list',
        entityId: list.id,
        action: 'archived',
        actor: 'system',
        timestamp: list.updatedAt,
        metadata: {},
      });
      return clone(list);
    },

    async restoreList(listId) {
      const list = lists.get(listId);
      if (!list) {
        throw new Error(`List not found: ${listId}`);
      }
      list.status = 'active';
      list.archivedAt = null;
      list.deletedAt = null;
      list.updatedAt = nowIso();
      appendEvent({
        id: createId('event'),
        entityType: 'list',
        entityId: list.id,
        action: 'restored',
        actor: 'system',
        timestamp: list.updatedAt,
        metadata: {},
      });
      return clone(list);
    },

    async deleteList(listId) {
      const list = lists.get(listId);
      if (!list) {
        throw new Error(`List not found: ${listId}`);
      }
      list.status = 'deleted';
      list.deletedAt = nowIso();
      list.updatedAt = list.deletedAt;
      appendEvent({
        id: createId('event'),
        entityType: 'list',
        entityId: list.id,
        action: 'deleted',
        actor: 'system',
        timestamp: list.updatedAt,
        metadata: {},
      });
      return clone(list);
    },

    async listTasks(listId) {
      return sortTasksByOrder([...tasks.values()].filter((task) => task.listId === listId && task.deletedAt === null)).map(clone);
    },

    async getTask(taskId) {
      const task = findTaskById(taskId);
      return task ? clone(task) : null;
    },

    async createTask(input: TodoTaskInput) {
      const timestamp = nowIso();
      const task: TodoItem = {
        id: createId('task'),
        listId: input.listId,
        title: input.title.trim(),
        notes: input.notes?.trim() ?? '',
        status: 'todo',
        priority: input.priority ?? 'medium',
        dueDate: input.dueDate ?? null,
        tags: input.tags ?? [],
        order: [...tasks.values()].filter((entry) => entry.listId === input.listId).length + 1,
        createdAt: timestamp,
        updatedAt: timestamp,
        completedAt: null,
        deletedAt: null,
      };
      tasks.set(task.id, task);
      recalculateList(input.listId);
      appendEvent({
        id: createId('event'),
        entityType: 'task',
        entityId: task.id,
        action: 'created',
        actor: 'system',
        timestamp,
        metadata: { listId: input.listId },
      });
      return clone(task);
    },

    async updateTask(taskId, input: TodoTaskUpdateInput) {
      const task = tasks.get(taskId);
      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }
      if (typeof input.title === 'string') {
        task.title = input.title.trim();
      }
      if (typeof input.notes === 'string') {
        task.notes = input.notes.trim();
      }
      if (input.priority) {
        task.priority = input.priority;
      }
      if ('dueDate' in input) {
        task.dueDate = input.dueDate ?? null;
      }
      if (input.tags) {
        task.tags = [...input.tags];
      }
      if (input.status) {
        task.status = input.status;
        task.completedAt = input.status === 'done' ? nowIso() : null;
      }
      task.updatedAt = nowIso();
      recalculateList(task.listId);
      appendEvent({
        id: createId('event'),
        entityType: 'task',
        entityId: task.id,
        action: 'updated',
        actor: 'system',
        timestamp: task.updatedAt,
        metadata: {},
      });
      return clone(task);
    },

    async completeTask(taskId, isComplete) {
      const task = tasks.get(taskId);
      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }
      task.status = isComplete ? 'done' : 'todo';
      task.completedAt = isComplete ? nowIso() : null;
      task.updatedAt = nowIso();
      recalculateList(task.listId);
      appendEvent({
        id: createId('event'),
        entityType: 'task',
        entityId: task.id,
        action: 'completed',
        actor: 'system',
        timestamp: task.updatedAt,
        metadata: { complete: isComplete },
      });
      return clone(task);
    },

    async deleteTask(taskId) {
      const task = tasks.get(taskId);
      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }
      task.status = 'deleted';
      task.deletedAt = nowIso();
      task.updatedAt = task.deletedAt;
      recalculateList(task.listId);
      appendEvent({
        id: createId('event'),
        entityType: 'task',
        entityId: task.id,
        action: 'deleted',
        actor: 'system',
        timestamp: task.updatedAt,
        metadata: {},
      });
      return clone(task);
    },

    async restoreTask(taskId) {
      const task = tasks.get(taskId);
      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }
      task.status = 'todo';
      task.deletedAt = null;
      task.updatedAt = nowIso();
      recalculateList(task.listId);
      appendEvent({
        id: createId('event'),
        entityType: 'task',
        entityId: task.id,
        action: 'restored',
        actor: 'system',
        timestamp: task.updatedAt,
        metadata: {},
      });
      return clone(task);
    },

    async listActivity() {
      return clone(activity);
    },

    async listTemplates() {
      return clone(templates);
    },

    async search(input: SearchInput) {
      const query = input.query.trim().toLowerCase();
      const allLists = [...lists.values()].filter((list) => list.deletedAt === null);
      const allTasks = getVisibleTasks([...lists.values()], [...tasks.values()]);

      if (query.length === 0) {
        return { query: input.query, results: [] };
      }

      const results: SearchResult[] = [
        ...allLists
          .filter((list) => [list.title, list.description].some((value) => value.toLowerCase().includes(query)))
          .map((list) => ({
            id: list.id,
            kind: 'list' as const,
            scope: 'workspace',
            title: list.title,
            description: list.description || 'No description.',
          })),
        ...allTasks
          .filter((task) => [task.title, task.notes, task.tags.join(' ')].some((value) => value.toLowerCase().includes(query)))
          .map((task) => ({
            id: task.id,
            kind: 'task' as const,
            scope: task.listId,
            title: task.title,
            description: task.notes || 'No notes.',
          })),
      ];

      return {
        query: input.query,
        results,
      };
    },
    async exportWorkspace() {
      return exportWorkspace();
    },
    async importWorkspace(workspace) {
      lists.clear(); tasks.clear(); activity.length = 0; templates.length = 0;
      workspace.lists.forEach((list) => lists.set(list.id, clone(list)));
      workspace.tasks.forEach((task) => tasks.set(task.id, clone(task)));
      activity.push(...workspace.activity.map(clone));
      templates.push(...workspace.templates.map(clone));
    },
  };

  const mutations = new Set<keyof WorkspaceRepository>([
    'createList', 'updateList', 'archiveList', 'restoreList', 'deleteList',
    'createTask', 'updateTask', 'completeTask', 'deleteTask', 'restoreTask', 'importWorkspace',
  ]);
  return new Proxy(repository, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof property !== 'string' || !mutations.has(property as keyof WorkspaceRepository) || typeof value !== 'function') return value;
      return async (...args: unknown[]) => {
        const result = await value.apply(target, args);
        options.onChange?.(exportWorkspace());
        return result;
      };
    },
  });
}
