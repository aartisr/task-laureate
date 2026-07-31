import { describe, expect, it } from 'vitest';
import { createMemoryTodoRepository } from '../mock/memoryRepository';
import { seedData } from '../mock/seed';
import { createWorkspaceExport, hydrateWorkspace, parseWorkspaceExport, persistWorkspace, type WorkspacePersistenceAdapter } from './workspace';

describe('workspace persistence contract', () => {
  it('round-trips a versioned, portable export', () => {
    const exported = createWorkspaceExport(seedData);
    const restored = parseWorkspaceExport(JSON.stringify(exported));
    expect(restored.format).toBe('task-laureate/workspace');
    expect(restored.data.tasks).toEqual(seedData.tasks);
  });

  it('rejects unknown or malformed export formats', () => {
    expect(() => parseWorkspaceExport('{"version":99}')).toThrow('supported Task-Laureate workspace export');
  });

  it('can hydrate from and persist to any adapter through the repository bridge', async () => {
    let stored = createWorkspaceExport(seedData);
    const adapter: WorkspacePersistenceAdapter = {
      load: async () => stored,
      save: async (workspace) => { stored = workspace; },
    };
    const repository = createMemoryTodoRepository(await hydrateWorkspace(adapter, seedData), { onChange: persistWorkspace(adapter) });
    await repository.createList({ title: 'Persisted list' });
    expect(stored.data.lists.some((list) => list.title === 'Persisted list')).toBe(true);
  });
});
