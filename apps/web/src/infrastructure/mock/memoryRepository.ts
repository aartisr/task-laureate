import type {
  ActivityEvent,
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
import { createCursorPage } from '../../core/domain/cursorPage';
import { sortListsForAttention } from '../../core/domain/listOrdering';
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

  /**
   * Older workspaces predate the completed-list status. Repair their derived
   * state on load, silently: a migration must never fabricate user activity.
   */
  const reconcilePersistedListLifecycle = () => {
    let changed = false;
    for (const list of lists.values()) {
      if (list.status === 'archived' || list.status === 'deleted') continue;
      const listTasks = [...tasks.values()].filter((task) => task.listId === list.id && task.deletedAt === null);
      const taskCount = listTasks.length;
      const completedTaskCount = listTasks.filter((task) => task.status === 'done').length;
      const completionPercent = computeListCompletion(listTasks);
      if (list.taskCount !== taskCount) { list.taskCount = taskCount; changed = true; }
      if (list.completedTaskCount !== completedTaskCount) { list.completedTaskCount = completedTaskCount; changed = true; }
      if (list.completionPercent !== completionPercent) { list.completionPercent = completionPercent; changed = true; }
      const allDone = taskCount > 0 && taskCount === completedTaskCount;
      if (allDone && list.status !== 'completed') {
        list.status = 'completed';
        list.completedAt ??= listTasks.map((task) => task.completedAt).filter((value): value is string => Boolean(value)).sort().at(-1) ?? list.updatedAt;
        changed = true;
      } else if (!allDone && list.status === 'completed') {
        list.status = 'active';
        list.completedAt = null;
        changed = true;
      }
    }
    return changed;
  };

  const repairedOnLoad = reconcilePersistedListLifecycle();

  const recalculateList = (listId: string) => {
    const list = lists.get(listId);
    if (!list) {
      return null;
    }

    const listTasks = sortTasksByOrder([...tasks.values()].filter((task) => task.listId === listId));
    list.taskCount = listTasks.filter((task) => task.deletedAt === null).length;
    list.completedTaskCount = listTasks.filter((task) => task.status === 'done' && task.deletedAt === null).length;
    list.completionPercent = computeListCompletion(listTasks);
    const timestamp = nowIso();
    // Do not auto-dispose success. Completion is an achievement state that
    // becomes active again only when work is explicitly reopened.
    if (list.status !== 'archived' && list.status !== 'deleted') {
      const allDone = list.taskCount > 0 && list.completedTaskCount === list.taskCount;
      if (allDone && list.status !== 'completed') {
        list.status = 'completed';
        list.completedAt = timestamp;
        appendEvent({ id: createId('event'), entityType: 'list', entityId: list.id, action: 'completed', actor: 'system', timestamp, metadata: { taskCount: list.taskCount } });
      } else if (!allDone && list.status === 'completed') {
        list.status = 'active';
        list.completedAt = null;
        appendEvent({ id: createId('event'), entityType: 'list', entityId: list.id, action: 'restored', actor: 'system', timestamp, metadata: { reason: 'work_reopened' } });
      }
    }
    list.updatedAt = timestamp;
    return list;
  };

  const findTaskById = (taskId: string) => tasks.get(taskId) ?? null;

  const requireVisibleList = (listId: string) => {
    const list = lists.get(listId);
    if (!list) {
      throw new Error(`List not found: ${listId}`);
    }
    if (list.deletedAt !== null) {
      throw new Error(`Cannot change tasks in deleted list: ${listId}`);
    }
    if (list.status === 'archived') {
      throw new Error(`Restore this list before changing its tasks: ${listId}`);
    }
    return list;
  };

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
        // The dashboard is for action. Completed work remains reachable from
        // Completed and All Lists, but never occupies an active-work slot.
        lists: sortListsForAttention(allLists.filter((list) => list.deletedAt === null && list.status === 'active')).map(clone),
      };
    },

    async listLists() {
      return sortListsForAttention([...lists.values()].filter((list) => list.deletedAt === null)).map(clone);
    },

    async listListsPage(input) {
      const visible = [...lists.values()]
        .filter((list) => list.deletedAt === null)
        .filter((list) => !input?.status || list.status === input.status)
        .filter((list) => !input?.query || `${list.title} ${list.description}`.toLowerCase().includes(input.query.trim().toLowerCase()))
        .sort((a, b) => {
          if (input?.sort === 'title') return a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
          if (input?.sort === 'progress') return b.completionPercent - a.completionPercent || b.id.localeCompare(a.id);
          if (input?.sort === 'tasks') return b.taskCount - a.taskCount || b.id.localeCompare(a.id);
          return b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id);
        });
      const page = createCursorPage(visible, input);
      return { ...page, items: page.items.map(clone) };
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
        completedAt: null,
        archivedFromStatus: null,
        deletedFromStatus: null,
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
        if (input.status === 'active') list.completedAt = null;
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
      if (list.status === 'archived') return clone(list);
      if (list.status === 'deleted') throw new Error(`Restore this list before archiving it: ${listId}`);
      list.archivedFromStatus = list.status === 'completed' ? 'completed' : 'active';
      list.status = 'archived';
      list.archivedAt = nowIso();
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
      if (list.status !== 'archived' && list.status !== 'deleted') return clone(list);
      list.status = list.status === 'deleted' ? (list.deletedFromStatus ?? 'active') : (list.archivedFromStatus ?? 'active');
      if (list.status !== 'archived') list.archivedAt = null;
      list.archivedFromStatus = null;
      list.deletedFromStatus = null;
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
      if (list.status === 'deleted') return clone(list);
      list.deletedFromStatus = list.status === 'completed' || list.status === 'archived' ? list.status : 'active';
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
      if (lists.get(listId)?.deletedAt !== null) {
        return [];
      }
      return sortTasksByOrder([...tasks.values()].filter((task) => task.listId === listId && task.deletedAt === null)).map(clone);
    },

    async getTask(taskId) {
      const task = findTaskById(taskId);
      return task ? clone(task) : null;
    },

    async createTask(input: TodoTaskInput) {
      requireVisibleList(input.listId);
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
      requireVisibleList(task.listId);
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

    async moveTask(taskId, destinationListId) {
      const task = tasks.get(taskId);
      if (!task) throw new Error(`Task not found: ${taskId}`);
      const sourceListId = task.listId;
      requireVisibleList(sourceListId);
      requireVisibleList(destinationListId);
      if (sourceListId === destinationListId) return clone(task);
      task.listId = destinationListId;
      task.order = Math.max(0, ...[...tasks.values()].filter((item) => item.listId === destinationListId && item.id !== taskId).map((item) => item.order)) + 1;
      task.updatedAt = nowIso();
      recalculateList(sourceListId);
      recalculateList(destinationListId);
      return clone(task);
    },

    async completeTask(taskId, isComplete) {
      const task = tasks.get(taskId);
      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }
      requireVisibleList(task.listId);
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
      requireVisibleList(task.listId);
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

    async listActivityPage(input) {
      const ordered = [...activity].sort((a, b) => b.timestamp.localeCompare(a.timestamp) || b.id.localeCompare(a.id));
      const page = createCursorPage(ordered, input);
      return { ...page, items: page.items.map(clone) };
    },

    async clearActivity() {
      activity.length = 0;
    },

    async listTemplates() {
      return clone(templates);
    },

    async search(input: SearchInput) {
      const query = input.query.trim().toLowerCase();
      const allLists = [...lists.values()].filter((list) => list.deletedAt === null);
      const allTasks = getVisibleTasks([...lists.values()], [...tasks.values()]);
      const listStatusById = new Map([...lists.values()].map((list) => [list.id, list.status]));

      if (query.length === 0) {
        return { query: input.query, results: [] };
      }

      const results: SearchResult[] = [
        ...sortListsForAttention(allLists)
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
          .sort((left, right) => {
            const leftActive = listStatusById.get(left.listId) === 'active' ? 0 : 1;
            const rightActive = listStatusById.get(right.listId) === 'active' ? 0 : 1;
            return leftActive - rightActive || right.updatedAt.localeCompare(left.updatedAt) || right.id.localeCompare(left.id);
          })
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
      reconcilePersistedListLifecycle();
    },
  };

  const mutations = new Set<keyof WorkspaceRepository>([
    'createList', 'updateList', 'archiveList', 'restoreList', 'deleteList',
    'createTask', 'updateTask', 'completeTask', 'deleteTask', 'restoreTask', 'clearActivity', 'importWorkspace',
  ]);
  const proxiedRepository = new Proxy(repository, {
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
  // Persist the silent repair so the same legacy list does not need repair on
  // every sign-in. This intentionally produces no user-facing activity event.
  if (repairedOnLoad) options.onChange?.(exportWorkspace());
  return proxiedRepository;
}
