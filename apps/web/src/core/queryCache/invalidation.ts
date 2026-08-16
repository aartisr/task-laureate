import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '../contracts/queryKeys';

/** Refreshes the query families affected by a workspace-level change. */
export function invalidateWorkspaceOverview(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
    queryClient.invalidateQueries({ queryKey: queryKeys.lists }),
    queryClient.invalidateQueries({ queryKey: queryKeys.activity }),
  ]);
}

/** Refreshes the task families affected by a change within one List. */
export function invalidateListTasks(queryClient: QueryClient, listId: string) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.list(listId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.tasks(listId) }),
  ]);
}
