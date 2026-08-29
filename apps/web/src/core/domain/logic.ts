import type { DashboardSummary, TodoItem, TodoList } from '../contracts/domain';

/**
 * A deleted list keeps its tasks so deletion can be undone. Those tasks are
 * intentionally hidden from every workspace-level view until the list is
 * restored.
 */
export function getVisibleTasks(lists: TodoList[], tasks: TodoItem[]) {
  const visibleListIds = new Set(
    lists.filter((list) => list.deletedAt === null && (list.status === 'active' || list.status === 'completed')).map((list) => list.id),
  );

  return tasks.filter((task) => task.deletedAt === null && visibleListIds.has(task.listId));
}

export function computeDashboardSummary(lists: TodoList[], tasks: TodoItem[]): DashboardSummary {
  const visibleTasks = getVisibleTasks(lists, tasks);
  const taskCount = visibleTasks.length;
  const completedCount = visibleTasks.filter((task) => task.status === 'done').length;
  const activeCount = visibleTasks.filter((task) => task.status !== 'done').length;

  return {
    listCount: lists.filter((list) => list.deletedAt === null && list.status === 'active').length,
    completedListCount: lists.filter((list) => list.deletedAt === null && list.status === 'completed').length,
    taskCount,
    completedCount,
    activeCount,
  };
}

/** Uses the same visible task population as the Tasks and Completed dashboard tiles. */
export function getDashboardCompletionPercent(summary: DashboardSummary) {
  return summary.taskCount === 0
    ? 0
    : Math.round((summary.completedCount / summary.taskCount) * 100);
}

export function computeListCompletion(tasks: TodoItem[]) {
  const visibleTasks = tasks.filter((task) => task.deletedAt === null);
  if (visibleTasks.length === 0) {
    return 0;
  }

  const completed = visibleTasks.filter((task) => task.status === 'done').length;
  return Math.round((completed / visibleTasks.length) * 100);
}

export function sortTasksByOrder(tasks: TodoItem[]) {
  return [...tasks].sort((left, right) => left.order - right.order);
}
