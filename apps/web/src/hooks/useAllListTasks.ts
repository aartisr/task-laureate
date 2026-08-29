import { useQueries, useQuery } from '@tanstack/react-query';
import { appServices } from '../app/runtime/appServices';
import type { TodoItem, TodoList } from '../core/contracts/domain';
import { listTasksQueryOptions, queryKeys } from '../core/contracts/queryKeys';
import { supportsReporting, type WorkspaceReport } from '../core/contracts/repository';

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
  isTruncated: boolean;
} {
  const reportRepository = supportsReporting(appServices.repository) ? appServices.repository : null;
  const reportingEnabled = reportRepository !== null;
  const reportQuery = useQuery<WorkspaceReport | null>({ queryKey: queryKeys.workspaceReport(300), queryFn: () => reportRepository ? reportRepository.getWorkspaceReport({ taskLimit: 300 }) : Promise.resolve(null), enabled: reportingEnabled, staleTime: 30_000 });
  // Aggregate reports are history surfaces. They intentionally include both
  // active and completed lists even though the dashboard is active-only.
  const listsQuery = useQuery({ queryKey: queryKeys.lists, queryFn: () => appServices.repository.listLists(), enabled: !reportingEnabled, staleTime: 5_000 });
  const lists = reportQuery.data?.lists ?? (listsQuery.data ?? []).filter((list) => list.status === 'active' || list.status === 'completed');
  const taskQueries = useQueries({
    queries: lists.map((list) => ({ ...listTasksQueryOptions(appServices.repository, list.id), enabled: !reportingEnabled && Boolean(list.id) })),
  });

  const allTasks = reportQuery.data?.tasks ?? lists.flatMap((list, index) =>
    (taskQueries[index]?.data ?? [])
      .filter((task) => task.deletedAt === null)
      .map((task) => ({ ...task, listTitle: list.title })),
  );

  return {
    allTasks,
    lists,
    loading: reportQuery.isLoading || (!reportingEnabled && (listsQuery.isLoading || taskQueries.some((query) => query.isLoading))),
    isTruncated: reportQuery.data?.isTruncated ?? false,
  };
}
