import { useSuspenseQuery, useQuery } from '@tanstack/react-query';
import { QueryKey } from '@tanstack/react-query';

/**
 * Result object for data queries
 */
export interface DataQueryState<T> {
  data: T | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

/**
 * Generic hook for suspenseful data queries
 * 
 * Handles:
 * - Data fetching with TanStack Query
 * - Loading/error states
 * - Proper stale time
 * 
 * Usage:
 * ```tsx
 * const { data, isLoading } = useSuspenseQuery({
 *   queryKey: queryKeys.list(id),
 *   queryFn: () => repository.getList(id),
 * });
 * ```
 */
export function useDataQuery<T>({
  queryKey,
  queryFn,
  staleTime = 5000,
}: {
  queryKey: QueryKey;
  queryFn: () => Promise<T>;
  staleTime?: number;
}) {
  return useSuspenseQuery({
    queryKey,
    queryFn,
    staleTime,
  });
}

/**
 * Generic hook for optional data queries
 * 
 * Handles:
 * - Conditional data fetching
 * - Loading/error states
 * - Safe for optional data
 * 
 * Usage:
 * ```tsx
 * const { data = [] } = useOptionalQuery({
 *   queryKey: queryKeys.search(query),
 *   queryFn: () => repository.search(query),
 *   enabled: !!query,
 * });
 * ```
 */
export function useOptionalQuery<T>({
  queryKey,
  queryFn,
  enabled = true,
  staleTime = 10000,
  initialData,
}: {
  queryKey: QueryKey;
  queryFn: () => Promise<T>;
  enabled?: boolean;
  staleTime?: number;
  initialData?: T;
}) {
  return useQuery({
    queryKey,
    queryFn,
    enabled,
    staleTime,
    initialData,
  });
}

/**
 * Compose multiple queries into a single state object
 * 
 * Usage:
 * ```tsx
 * const list = useSuspenseQuery(...);
 * const tasks = useSuspenseQuery(...);
 * 
 * const { data, isLoading, isError } = useComposedQueries([list, tasks]);
 * ```
 */
export function useComposedQueries<T extends readonly any[]>(
  queries: readonly [...{ data: any; isLoading?: boolean; isError?: boolean; error?: Error | null }[]]
): {
  data: any[];
  isLoading: boolean;
  isError: boolean;
  errors: (Error | null)[];
} {
  const data = queries.map((q) => q.data);
  const isLoading = queries.some((q) => q.isLoading);
  const isError = queries.some((q) => q.isError);
  const errors = queries.map((q) => q.error ?? null);

  return { data, isLoading, isError, errors };
}
