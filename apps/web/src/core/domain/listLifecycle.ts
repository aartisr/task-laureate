import type { TodoList } from '../contracts/domain';

export const COMPLETED_RECENT_DAYS = 30;

/** Pure policy so a server job, offline client, or UI can share one rule. */
export function archiveRecommendation(list: TodoList, now = new Date()): Date | null {
  if (list.status !== 'completed' || !list.completedAt) return null;
  const due = new Date(list.completedAt);
  due.setDate(due.getDate() + COMPLETED_RECENT_DAYS);
  return due <= now ? due : null;
}

export function isRecentlyCompleted(list: TodoList, now = new Date()) {
  return list.status === 'completed' && !archiveRecommendation(list, now);
}
