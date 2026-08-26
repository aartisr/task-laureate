import type { TodoList } from '../contracts/domain';

/**
 * A workspace is a queue for action before it is a record of activity.
 * Keep this ordering anywhere a mixed collection of lists is presented.
 */
export function sortListsForAttention<T extends Pick<TodoList, 'status' | 'updatedAt' | 'id'>>(lists: T[]): T[] {
  const rank: Record<TodoList['status'], number> = { active: 0, completed: 1, archived: 2, deleted: 3 };
  return [...lists].sort((left, right) =>
    rank[left.status] - rank[right.status]
    || right.updatedAt.localeCompare(left.updatedAt)
    || right.id.localeCompare(left.id),
  );
}
