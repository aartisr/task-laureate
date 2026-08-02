import { describe, expect, it } from 'vitest';
import { createMemoryTodoRepository } from './memoryRepository';
import type { WorkspaceData } from '../persistence/workspace';

const timestamp = '2026-08-01T12:00:00.000Z';

describe('legacy list lifecycle reconciliation', () => {
  it('marks an old active list completed when every persisted task is done', async () => {
    const workspace: WorkspaceData = {
      lists: [{ id: 'list-1', title: 'Legacy list', description: '', status: 'active', templateId: null, createdAt: timestamp, updatedAt: timestamp, archivedAt: null, deletedAt: null, completionPercent: 0, taskCount: 0, completedTaskCount: 0 }],
      tasks: [{ id: 'task-1', listId: 'list-1', title: 'Done', notes: '', status: 'done', priority: 'medium', dueDate: null, tags: [], order: 1, createdAt: timestamp, updatedAt: timestamp, completedAt: timestamp, deletedAt: null }],
      activity: [], templates: [],
    };
    const repository = createMemoryTodoRepository(workspace);
    const list = await repository.getList('list-1');
    expect(list).toMatchObject({ status: 'completed', taskCount: 1, completedTaskCount: 1, completionPercent: 100 });
    expect(list?.completedAt).toBe(timestamp);
  });
});
