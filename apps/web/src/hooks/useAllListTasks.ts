import { useQueries, useQuery } from '@tanstack/react-query';
import { appServices } from '../app/runtime/appServices';
import type { TodoItem, TodoList } from '../core/contracts/domain';
import { dashboardQueryOptions, listTasksQueryOptions } from '../core/contracts/queryKeys';

/** A task enriched with the List label required by cross-List views. */
export type TaskWithListTitle = TodoItem & { listTitle: string };

/**
 * Loads the complete visible task set for aggregate views such as Completed
 * and Progress. `useQueries` keeps the hook call graph stable while the
 * number of Lists changes, unlike calling `useQuery` inside a dynamic loop.
 */
export function useAllListTasks(): {
  allTasks: TaskWithListTitle[];
  lists: TodoList[];
  loading: boolean;
} {
  const dashboardQuery = useQuery(dashboardQueryOptions(appServices.repository));
  const lists = dashboardQuery.data?.lists ?? [];
  const taskQueries = useQueries({
    queries: lists.map((list) => ({ ...listTasksQueryOptions(appServices.repository, list.id), enabled: Boolean(list.id) })),
  });

  const allTasks = lists.flatMap((list, index) =>
    (taskQueries[index]?.data ?? [])
      .filter((task) => task.deletedAt === null)
      .map((task) => ({ ...task, listTitle: list.title })),
  );

  return {
    allTasks,
    lists,
    loading: dashboardQuery.isLoading || taskQueries.some((query) => query.isLoading),
  };
}
