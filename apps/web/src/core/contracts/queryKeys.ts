import { queryOptions } from '@tanstack/react-query';
import type { TodoRepository } from './repository';

export const queryKeys = {
  dashboard: ['dashboard'] as const,
  lists: ['lists'] as const,
  list: (listId: string) => ['lists', listId] as const,
  tasks: (listId: string) => ['lists', listId, 'tasks'] as const,
  search: (query: string) => ['search', query] as const,
  activity: ['activity'] as const,
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
