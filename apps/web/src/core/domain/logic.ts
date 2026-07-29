import type { DashboardSummary, TodoItem, TodoList } from '../contracts/domain';

export function computeDashboardSummary(lists: TodoList[], tasks: TodoItem[]): DashboardSummary {
  const taskCount = tasks.filter((task) => task.deletedAt === null).length;
  const completedCount = tasks.filter((task) => task.status === 'done' && task.deletedAt === null).length;
  const activeCount = tasks.filter((task) => task.status !== 'done' && task.deletedAt === null).length;

  return {
    listCount: lists.filter((list) => list.deletedAt === null).length,
    taskCount,
    completedCount,
    activeCount,
  };
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
