import { useSuspenseQuery, useQuery } from '@tanstack/react-query';
import { queryKeys } from '../core/contracts/queryKeys';
import type { SearchResult } from '../core/contracts/domain';
import type { TodoRepository } from '../core/contracts/repository';

export interface UseQueryStatesOptions {
  repository: TodoRepository;
  listId?: string;
  searchQuery?: string;
}

/**
 * Unified hook for accessing all query states
 * Provides type-safe access to dashboard, lists, tasks, search, and activity data
 */
export function useQueryStates({ repository, listId, searchQuery }: UseQueryStatesOptions) {
  // Dashboard query
  const dashboardQuery = useSuspenseQuery({
    queryKey: queryKeys.dashboard,
    queryFn: () => repository.getDashboard(),
    staleTime: 5000,
  });

  // Lists query
  const listsQuery = useSuspenseQuery({
    queryKey: queryKeys.lists,
    queryFn: () => repository.listLists(),
    staleTime: 5000,
  });

  // Current list query (if listId provided)
  const listQuery = useQuery({
    queryKey: queryKeys.list(listId || ''),
    queryFn: () => (listId ? repository.getList(listId) : Promise.resolve(null)),
    enabled: !!listId,
    staleTime: 5000,
  });

  // Tasks for current list (if listId provided)
  const tasksQuery = useQuery({
    queryKey: queryKeys.tasks(listId || ''),
    queryFn: () => (listId ? repository.listTasks(listId) : Promise.resolve([])),
    enabled: !!listId,
    staleTime: 5000,
  });

  // Search results (if searchQuery provided)
  const searchQuery_ = useQuery<SearchResult[]>({
    queryKey: queryKeys.search(searchQuery || ''),
    queryFn: async () =>
      searchQuery
        ? (await repository.search({ query: searchQuery })).results
        : [],
    enabled: !!searchQuery,
    staleTime: 10000,
  });

  // Activity log
  const activityQuery = useSuspenseQuery({
    queryKey: queryKeys.activity,
    queryFn: () => repository.listActivity(),
    staleTime: 10000,
  });

  return {
    // Dashboard
    dashboard: dashboardQuery.data,
    dashboardLoading: dashboardQuery.isLoading,
    dashboardError: dashboardQuery.error,

    // All lists
    lists: listsQuery.data || [],
    listsLoading: listsQuery.isLoading,
    listsError: listsQuery.error,

    // Current list
    currentList: listQuery.data,
    currentListLoading: listQuery.isLoading,
    currentListError: listQuery.error,

    // Tasks in current list
    tasks: tasksQuery.data || [],
    tasksLoading: tasksQuery.isLoading,
    tasksError: tasksQuery.error,

    // Search results
    searchResults: searchQuery_.data || [],
    searchLoading: searchQuery_.isLoading,
    searchError: searchQuery_.error,

    // Activity
    activity: activityQuery.data || [],
    activityLoading: activityQuery.isLoading,
    activityError: activityQuery.error,

    // Helpers
    isLoading:
      dashboardQuery.isLoading ||
      listsQuery.isLoading ||
      listQuery.isLoading ||
      tasksQuery.isLoading ||
      searchQuery_.isLoading,
    hasError:
      dashboardQuery.error ||
      listsQuery.error ||
      listQuery.error ||
      tasksQuery.error ||
      searchQuery_.error ||
      activityQuery.error,
  };
}
