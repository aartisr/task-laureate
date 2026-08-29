import { queryOptions } from '@tanstack/react-query';
import type { TodoRepository } from './repository';

export const queryKeys = {
  dashboard: ['dashboard'] as const,
  lists: ['lists'] as const,
  listsPage: (input: { cursor: string | null; limit: number; status?: string; query?: string; sort?: string }) =>
    ['lists', 'page', input] as const,
  list: (listId: string) => ['lists', listId] as const,
  tasks: (listId: string) => ['lists', listId, 'tasks'] as const,
  search: (query: string) => ['search', query] as const,
  activity: ['activity'] as const,
  activityPage: (cursor: string | null, limit: number) => ['activity', 'page', cursor, limit] as const,
  taskFeed: (input: { status?: string; priority?: string; query?: string; cursor?: string | null; limit?: number }) => ['tasks', 'feed', input] as const,
  collaboration: {
    sharedResources: ['collaboration', 'shared-resources'] as const,
    sharedWithMe: ['collaboration', 'shared-with-me'] as const,
    sharedByMe: ['collaboration', 'shared-by-me'] as const,
    resourceAccess: (resourceType: 'list' | 'task', resourceId: string) => ['collaboration', 'resource-access', resourceType, resourceId] as const,
  },
  execution: {
    root: ['execution'] as const,
    tasks: ['execution', 'tasks'] as const,
    planning: (taskIds: string) => ['execution', 'planning', taskIds] as const,
  },
  taskPlanning: (taskId: string) => ['task-planning', taskId] as const,
  calendarBlock: (taskId: string) => ['calendar-block', taskId] as const,
  taskEvents: {
    root: ['task-events'] as const,
    weekly: ['task-events', 'weekly'] as const,
  },
  workspaceReport: (taskLimit: number) => ['workspace-report', taskLimit] as const,
} as const;

export function dashboardQueryOptions(repository: TodoRepository) {
  return queryOptions({
    queryKey: queryKeys.dashboard,
    queryFn: () => repository.getDashboard(),
  });
}

export function listQueryOptions(repository: TodoRepository, listId: string) {
  return queryOptions({
    queryKey: queryKeys.list(listId),
    queryFn: () => repository.getList(listId),
  });
}

export function listTasksQueryOptions(repository: TodoRepository, listId: string) {
  return queryOptions({
    queryKey: queryKeys.tasks(listId),
    queryFn: () => repository.listTasks(listId),
  });
}

export function searchQueryOptions(repository: TodoRepository, query: string) {
  return queryOptions({
    queryKey: queryKeys.search(query),
    queryFn: () => repository.search({ query }),
  });
}

export function activityQueryOptions(repository: TodoRepository) {
  return queryOptions({
    queryKey: queryKeys.activity,
    queryFn: () => repository.listActivity(),
  });
}
