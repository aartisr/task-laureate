import { describe, expect, it } from 'vitest';
import { createMemoryTodoRepository } from '../mock/memoryRepository';
import { createTestWorkspace } from '../../test/fixtures/workspace';
import { browserWorkspaceKeyForUser, createBufferedPersistence, createWorkspaceExport, hydrateWorkspace, parseWorkspaceExport, persistWorkspace, type WorkspaceData, type WorkspacePersistenceAdapter } from './workspace';

describe('workspace persistence contract', () => {
  it('round-trips a versioned, portable export', () => {
    const workspace = createTestWorkspace();
    const exported = createWorkspaceExport(workspace);
    const restored = parseWorkspaceExport(JSON.stringify(exported));
    expect(restored.format).toBe('task-laureate/workspace');
    expect(restored.data.tasks).toEqual(workspace.tasks);
  });

  it('rejects unknown or malformed export formats', () => {
    expect(() => parseWorkspaceExport('{"version":99}')).toThrow('supported Task-Laureate workspace export');
  });

  it('uses a distinct browser cache namespace for every authenticated user', () => {
    expect(browserWorkspaceKeyForUser('user-a')).not.toBe(browserWorkspaceKeyForUser('user-b'));
    expect(browserWorkspaceKeyForUser('user a')).toContain('user%20a');
  });

  it('can hydrate from and persist to any adapter through the repository bridge', async () => {
    const workspace = createTestWorkspace();
    let stored = createWorkspaceExport(workspace);
    const adapter: WorkspacePersistenceAdapter = {
      load: async () => stored,
      save: async (workspace) => { stored = workspace; },
    };
    const repository = createMemoryTodoRepository(await hydrateWorkspace(adapter, workspace), { onChange: persistWorkspace(adapter) });
    await repository.createList({ title: 'Persisted list' });
    expect(stored.data.lists.some((list) => list.title === 'Persisted list')).toBe(true);
  });

  it('coalesces bursts so only the newest workspace is written', async () => {
    const writes: string[] = [];
    const adapter: WorkspacePersistenceAdapter = {
      load: async () => null,
      save: async (workspace) => { writes.push(workspace.data.lists[0].title); },
    };
    const buffer = createBufferedPersistence(adapter, { debounceMs: 10_000 });
    const workspace = createTestWorkspace();
    buffer.schedule(workspace);
    buffer.schedule({ ...workspace, lists: [{ ...workspace.lists[0], title: 'Newest' }, ...workspace.lists.slice(1)] });
    await buffer.flush();
    expect(writes).toEqual(['Newest']);
  });

  it('drops queued writes when an account workspace is disposed', async () => {
    const writes: WorkspaceData[] = [];
    const adapter: WorkspacePersistenceAdapter = { load: async () => null, save: async (workspace) => { writes.push(workspace.data); } };
    const buffer = createBufferedPersistence(adapter, { debounceMs: 10_000 });
    buffer.schedule(createTestWorkspace());
    buffer.dispose();
    await buffer.flush();
    expect(writes).toEqual([]);
  });
});
