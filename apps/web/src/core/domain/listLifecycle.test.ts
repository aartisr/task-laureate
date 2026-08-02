import { describe, expect, it } from 'vitest';
import { archiveRecommendation, isRecentlyCompleted } from './listLifecycle';
import type { TodoList } from '../contracts/domain';

const list = (completedAt: string): TodoList => ({ id: 'l', title: 'Done', description: '', status: 'completed', templateId: null, createdAt: completedAt, updatedAt: completedAt, archivedAt: null, deletedAt: null, completedAt, completionPercent: 100, taskCount: 1, completedTaskCount: 1 });

describe('list completion retention policy', () => {
  it('keeps completed work visible for 30 days then recommends, never performs, archival', () => {
    const now = new Date('2026-08-01T00:00:00.000Z');
    expect(isRecentlyCompleted(list('2026-07-15T00:00:00.000Z'), now)).toBe(true);
    expect(archiveRecommendation(list('2026-06-01T00:00:00.000Z'), now)).not.toBeNull();
  });
});
