import { useMutation, useQueryClient } from '@tanstack/react-query';
import { appServices } from '../../app/runtime/appServices';
import type { DashboardSummary, TodoItem, TodoList } from '../contracts/domain';
import { queryKeys } from '../contracts/queryKeys';
import type { TodoListInput, TodoListUpdateInput, TodoTaskInput, TodoTaskUpdateInput } from '../contracts/repository';
import { undoJournal } from './undoJournal';
import { invalidateWorkspaceOverview } from '../queryCache/invalidation';

interface DashboardCache {
  summary: DashboardSummary;
  lists: TodoList[];
}

function countVisibleTasks(tasks: TodoItem[]) {
  const visible = tasks.filter((task) => task.deletedAt === null);
  const completed = visible.filter((task) => task.status === 'done').length;

  return {
    taskCount: visible.length,
    completedTaskCount: completed,
    completionPercent: visible.length === 0 ? 0 : Math.round((completed / visible.length) * 100),
  };
}

export function useTodoMutations() {
  const queryClient = useQueryClient();

  const refreshWorkspace = () => invalidateWorkspaceOverview(queryClient);

  const createList = useMutation({
    mutationFn: (input: TodoListInput) => appServices.repository.createList(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.dashboard });
      const previousDashboard = queryClient.getQueryData<DashboardCache>(queryKeys.dashboard);
      const optimisticId = `optimistic-${Date.now()}`;
      const optimisticList: TodoList = {
        id: optimisticId,
        title: input.title.trim(),
        description: input.description?.trim() ?? '',
        status: 'active',
        templateId: input.templateId ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        archivedAt: null,
        deletedAt: null,
        completionPercent: 0,
        taskCount: 0,
        completedTaskCount: 0,
      };

      queryClient.setQueryData<DashboardCache>(queryKeys.dashboard, (current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          summary: {
            ...current.summary,
            listCount: current.summary.listCount + 1,
          },
          lists: [optimisticList, ...current.lists],
        };
      });

      return { previousDashboard };
    },
    onError: (_error, _input, context) => {
      if (context?.previousDashboard) {
        queryClient.setQueryData(queryKeys.dashboard, context.previousDashboard);
      }
    },
    onSettled: refreshWorkspace,
  });

  const updateList = useMutation({
    mutationFn: ({ listId, input }: { listId: string; input: TodoListUpdateInput }) =>
      appServices.repository.updateList(listId, input),
    onSettled: refreshWorkspace,
  });

  const createTask = useMutation({
    mutationFn: (input: TodoTaskInput) => appServices.repository.createTask(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.dashboard });
      await queryClient.cancelQueries({ queryKey: queryKeys.tasks(input.listId) });
      await queryClient.cancelQueries({ queryKey: queryKeys.list(input.listId) });

      const previousDashboard = queryClient.getQueryData<DashboardCache>(queryKeys.dashboard);
      const previousTasks = queryClient.getQueryData<TodoItem[]>(queryKeys.tasks(input.listId)) ?? [];
      const previousList = queryClient.getQueryData<TodoList | null>(queryKeys.list(input.listId));

      const optimisticTask: TodoItem = {
        id: `optimistic-${Date.now()}`,
        listId: input.listId,
        title: input.title.trim(),
        notes: input.notes?.trim() ?? '',
        status: 'todo',
        priority: input.priority ?? 'medium',
        dueDate: input.dueDate ?? null,
        tags: input.tags ?? [],
        order: previousTasks.length + 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null,
        deletedAt: null,
      };

      queryClient.setQueryData<TodoItem[]>(queryKeys.tasks(input.listId), [...previousTasks, optimisticTask]);

      if (previousList) {
        const nextCounts = countVisibleTasks([...previousTasks, optimisticTask]);
        queryClient.setQueryData<TodoList>(queryKeys.list(input.listId), {
          ...previousList,
          ...nextCounts,
          updatedAt: new Date().toISOString(),
        });
      }

      queryClient.setQueryData<DashboardCache>(queryKeys.dashboard, (current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          summary: {
            ...current.summary,
            taskCount: current.summary.taskCount + 1,
            activeCount: current.summary.activeCount + 1,
          },
          lists: current.lists.map((list) =>
            list.id === input.listId
              ? {
                  ...list,
                  taskCount: list.taskCount + 1,
                  completionPercent: countVisibleTasks([...previousTasks, optimisticTask]).completionPercent,
                  updatedAt: new Date().toISOString(),
                }
              : list,
          ),
        };
      });

      return { previousDashboard, previousTasks, previousList };
    },
    onError: (_error, input, context) => {
      if (context?.previousDashboard) {
        queryClient.setQueryData(queryKeys.dashboard, context.previousDashboard);
      }
      if (context?.previousTasks) {
        queryClient.setQueryData(queryKeys.tasks(input.listId), context.previousTasks);
      }
      if (context?.previousList) {
        queryClient.setQueryData(queryKeys.list(input.listId), context.previousList);
      }
    },
    onSettled: async (_data, _error, variables) => {
      if (!variables) {
        await refreshWorkspace();
        return;
      }

      await Promise.all([
        refreshWorkspace(),
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks(variables.listId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.list(variables.listId) }),
      ]);
    },
  });

  const updateTask = useMutation({
    mutationFn: ({ taskId, input }: { taskId: string; input: TodoTaskUpdateInput }) =>
      appServices.repository.updateTask(taskId, input),
    onMutate: async ({ taskId, input }) => {
      const previousTasksEntries = [...queryClient.getQueriesData<unknown>({ queryKey: queryKeys.lists })];
      const previousDashboard = queryClient.getQueryData<DashboardCache>(queryKeys.dashboard);
      const previousListStates = new Map<string, TodoList | null>();
      const previousTaskStates = new Map<string, TodoItem[]>();

      for (const [key, value] of previousTasksEntries) {
        const listId = key[1];
        const isTaskCollection = key[2] === 'tasks';
        if (!isTaskCollection || typeof listId !== 'string' || !Array.isArray(value)) {
          continue;
        }

        const currentTasks = value as TodoItem[];
        const existingTask = currentTasks.find((task) => task.id === taskId);
        if (!existingTask) {
          continue;
        }

        previousTaskStates.set(listId, currentTasks);
        const nextTasks = currentTasks.map((task) =>
          task.id === taskId
            ? {
                ...task,
                ...input,
                updatedAt: new Date().toISOString(),
                completedAt:
                  input.status === 'done'
                    ? new Date().toISOString()
                    : input.status === 'todo'
                      ? null
                      : task.completedAt,
              }
            : task,
        );
        queryClient.setQueryData<TodoItem[]>(queryKeys.tasks(listId), nextTasks);
        previousListStates.set(listId, queryClient.getQueryData<TodoList | null>(queryKeys.list(listId)) || null);

        const nextCounts = countVisibleTasks(nextTasks);
        const currentList = previousListStates.get(listId);
        if (currentList) {
          queryClient.setQueryData<TodoList>(queryKeys.list(listId), {
            ...currentList,
            ...nextCounts,
            updatedAt: new Date().toISOString(),
          });
        }

        if (previousDashboard && input.status) {
          const completedDelta =
            existingTask.status === 'done' ? -1 : input.status === 'done' ? 1 : 0;
          const activeDelta =
            existingTask.status === 'done' ? 1 : input.status === 'done' ? -1 : 0;
          queryClient.setQueryData<DashboardCache>(queryKeys.dashboard, (current) =>
            current
              ? {
                  ...current,
                  summary: {
                    ...current.summary,
                    completedCount: Math.max(0, current.summary.completedCount + completedDelta),
                    activeCount: Math.max(0, current.summary.activeCount + activeDelta),
                  },
                  lists: current.lists.map((list) =>
                    list.id === listId
                      ? {
                          ...list,
                          completionPercent: nextCounts.completionPercent,
                          completedTaskCount: nextCounts.completedTaskCount,
                          taskCount: nextCounts.taskCount,
                          updatedAt: new Date().toISOString(),
                        }
                      : list,
                  ),
                }
              : current,
          );
        }
      }

      return { previousDashboard, previousListStates, previousTaskStates };
    },
    onError: (_error, _input, context) => {
      if (context?.previousDashboard) {
        queryClient.setQueryData(queryKeys.dashboard, context.previousDashboard);
      }
      if (context?.previousListStates) {
        for (const [listId, list] of context.previousListStates.entries()) {
          queryClient.setQueryData(queryKeys.list(listId), list);
        }
      }
      if (context?.previousTaskStates) {
        for (const [listId, tasks] of context.previousTaskStates.entries()) {
          queryClient.setQueryData(queryKeys.tasks(listId), tasks);
        }
      }
    },
    onSettled: async (task) => {
      if (task) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.tasks(task.listId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.list(task.listId) }),
          refreshWorkspace(),
        ]);
      } else {
        await refreshWorkspace();
      }
    },
  });

  const completeTask = useMutation({
    mutationFn: ({ taskId, isComplete }: { taskId: string; isComplete: boolean }) =>
      appServices.repository.completeTask(taskId, isComplete),
    onMutate: async ({ taskId, isComplete }) => {
      const cachedTasks = [...queryClient.getQueriesData<unknown>({ queryKey: queryKeys.lists })];
      const previousDashboard = queryClient.getQueryData<DashboardCache>(queryKeys.dashboard);
      const previousTaskStates = new Map<string, TodoItem[]>();
      let previousTask: TodoItem | undefined;

      for (const [key, value] of cachedTasks) {
        const listId = key[1];
        if (key[2] !== 'tasks' || typeof listId !== 'string' || !Array.isArray(value)) {
          continue;
        }

        const currentTasks = value as TodoItem[];
        const existingTask = currentTasks.find((task) => task.id === taskId);
        if (!existingTask) {
          continue;
        }
        previousTask ??= existingTask;

        previousTaskStates.set(listId, currentTasks);
        const nextTasks: TodoItem[] = currentTasks.map((task) =>
          task.id === taskId
            ? {
                ...task,
                status: (isComplete ? 'done' : 'todo') as any,
                completedAt: isComplete ? new Date().toISOString() : null,
                updatedAt: new Date().toISOString(),
              }
            : task,
        );

        queryClient.setQueryData<TodoItem[]>(queryKeys.tasks(listId), nextTasks);
        const nextCounts = countVisibleTasks(nextTasks);
        const currentList = queryClient.getQueryData<TodoList | null>(queryKeys.list(listId));
        if (currentList) {
          queryClient.setQueryData<TodoList>(queryKeys.list(listId), {
            ...currentList,
            ...nextCounts,
            updatedAt: new Date().toISOString(),
          });
        }

        if (previousDashboard) {
          queryClient.setQueryData<DashboardCache>(queryKeys.dashboard, {
            ...previousDashboard,
            summary: {
              ...previousDashboard.summary,
              completedCount: isComplete
                ? previousDashboard.summary.completedCount + 1
                : Math.max(0, previousDashboard.summary.completedCount - 1),
              activeCount: isComplete
                ? Math.max(0, previousDashboard.summary.activeCount - 1)
                : previousDashboard.summary.activeCount + 1,
            },
            lists: previousDashboard.lists.map((list) =>
              list.id === listId
                ? {
                    ...list,
                    completedTaskCount: isComplete
                      ? list.completedTaskCount + 1
                      : Math.max(0, list.completedTaskCount - 1),
                    completionPercent: nextCounts.completionPercent,
                    updatedAt: new Date().toISOString(),
                  }
                : list,
            ),
          });
        }
      }
      return { previousDashboard, previousTaskStates, previousTask };
    },
    onError: (_error, _input, context) => {
      if (context?.previousDashboard) {
        queryClient.setQueryData(queryKeys.dashboard, context.previousDashboard);
      }
      if (context?.previousTaskStates) {
        for (const [listId, tasks] of context.previousTaskStates.entries()) {
          queryClient.setQueryData(queryKeys.tasks(listId), tasks);
        }
      }
    },
    onSuccess: (task, variables, context) => {
      const before = context?.previousTask;
      if (!before) return;
      const wasComplete = before.status === 'done';
      undoJournal.record({
        label: variables.isComplete ? `Completed “${before.title}”` : `Reopened “${before.title}”`,
        undo: async () => {
          await appServices.repository.completeTask(variables.taskId, wasComplete);
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: queryKeys.tasks(task.listId) }),
            queryClient.invalidateQueries({ queryKey: queryKeys.list(task.listId) }),
            refreshWorkspace(),
          ]);
        },
        redo: async () => {
          await appServices.repository.completeTask(variables.taskId, variables.isComplete);
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: queryKeys.tasks(task.listId) }),
            queryClient.invalidateQueries({ queryKey: queryKeys.list(task.listId) }),
            refreshWorkspace(),
          ]);
        },
      });
    },
    onSettled: async (task) => {
      if (task) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.tasks(task.listId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.list(task.listId) }),
          refreshWorkspace(),
        ]);
      } else {
        await refreshWorkspace();
      }
    },
  });

  const deleteTask = useMutation({
    mutationFn: (taskId: string) => appServices.repository.deleteTask(taskId),
    onMutate: async (taskId) => {
      const cachedTasks = [...queryClient.getQueriesData<unknown>({ queryKey: queryKeys.lists })];
      const previousDashboard = queryClient.getQueryData<DashboardCache>(queryKeys.dashboard);
      const previousTaskStates = new Map<string, TodoItem[]>();

      for (const [key, value] of cachedTasks) {
        const listId = key[1];
        if (key[2] !== 'tasks' || typeof listId !== 'string' || !Array.isArray(value)) {
          continue;
        }

        const currentTasks = value as TodoItem[];
        const existingTask = currentTasks.find((task) => task.id === taskId);
        if (!existingTask) {
          continue;
        }

        previousTaskStates.set(listId, currentTasks);
        const nextTasks = currentTasks.filter((task) => task.id !== taskId);
        queryClient.setQueryData<TodoItem[]>(queryKeys.tasks(listId), nextTasks);
        const nextCounts = countVisibleTasks(nextTasks);
        const currentList = queryClient.getQueryData<TodoList | null>(queryKeys.list(listId));
        if (currentList) {
          queryClient.setQueryData<TodoList>(queryKeys.list(listId), {
            ...currentList,
            ...nextCounts,
            updatedAt: new Date().toISOString(),
          });
        }

        if (previousDashboard) {
          queryClient.setQueryData<DashboardCache>(queryKeys.dashboard, {
            ...previousDashboard,
            summary: {
              ...previousDashboard.summary,
              taskCount: Math.max(0, previousDashboard.summary.taskCount - 1),
              completedCount:
                existingTask.status === 'done'
                  ? Math.max(0, previousDashboard.summary.completedCount - 1)
                  : previousDashboard.summary.completedCount,
              activeCount:
                existingTask.status === 'done'
                  ? previousDashboard.summary.activeCount
                  : Math.max(0, previousDashboard.summary.activeCount - 1),
            },
            lists: previousDashboard.lists.map((list) =>
              list.id === listId
                ? {
                    ...list,
                    taskCount: Math.max(0, list.taskCount - 1),
                    completedTaskCount:
                      existingTask.status === 'done'
                        ? Math.max(0, list.completedTaskCount - 1)
                        : list.completedTaskCount,
                    completionPercent: nextCounts.completionPercent,
                    updatedAt: new Date().toISOString(),
                  }
                : list,
            ),
          });
        }
      }
      return { previousDashboard, previousTaskStates };
    },
    onError: (_error, _taskId, context) => {
      if (context?.previousDashboard) {
        queryClient.setQueryData(queryKeys.dashboard, context.previousDashboard);
      }
      if (context?.previousTaskStates) {
        for (const [listId, tasks] of context.previousTaskStates.entries()) {
          queryClient.setQueryData(queryKeys.tasks(listId), tasks);
        }
      }
    },
    onSettled: async (task) => {
      if (task) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.tasks(task.listId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.list(task.listId) }),
          refreshWorkspace(),
        ]);
      } else {
        await refreshWorkspace();
      }
    },
  });

  return {
    createList,
    updateList,
    createTask,
    updateTask,
    completeTask,
    deleteTask,
  };
}
