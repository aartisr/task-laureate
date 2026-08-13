import { describe, expect, it, vi } from 'vitest';
import { createTodoRemoteMutationDelivery } from './remoteMutationDelivery';

const entry = (type: string, payload: unknown) => ({ id: 'entry', type, payload, idempotencyKey: 'stable', createdAt: '2026-08-13T15:00:00.000Z', state: 'pending' as const });

describe('todo remote mutation delivery adapter', () => {
  it('maps every supported serializable command to the repository', async () => {
    const repository = {
      updateTask: vi.fn(), completeTask: vi.fn(), deleteTask: vi.fn(), restoreTask: vi.fn(),
      updateList: vi.fn(), archiveList: vi.fn(), deleteList: vi.fn(), restoreList: vi.fn(),
      createTaskIdempotent: vi.fn(), createListIdempotent: vi.fn(),
    };
    const deliver = createTodoRemoteMutationDelivery(repository as any);
    await deliver(entry('task.create', { input: { listId: 'l1', title: 'Created' } }));
    await deliver(entry('list.create', { input: { title: 'Created' } }));
    await deliver(entry('task.update', { taskId: 't1', input: { title: 'Changed' } }));
    await deliver(entry('task.complete', { taskId: 't1', isComplete: true }));
    await deliver(entry('task.delete', { taskId: 't1' }));
    await deliver(entry('task.restore', { taskId: 't1' }));
    await deliver(entry('list.update', { listId: 'l1', input: { title: 'Changed' } }));
    await deliver(entry('list.archive', { listId: 'l1' }));
    await deliver(entry('list.delete', { listId: 'l1' }));
    await deliver(entry('list.restore', { listId: 'l1' }));
    expect(repository.updateTask).toHaveBeenCalledWith('t1', { title: 'Changed' });
    expect(repository.createTaskIdempotent).toHaveBeenCalledWith({ listId: 'l1', title: 'Created' }, 'stable');
    expect(repository.createListIdempotent).toHaveBeenCalledWith({ title: 'Created' }, 'stable');
    expect(repository.completeTask).toHaveBeenCalledWith('t1', true);
    expect(repository.deleteTask).toHaveBeenCalledWith('t1');
    expect(repository.restoreTask).toHaveBeenCalledWith('t1');
    expect(repository.updateList).toHaveBeenCalledWith('l1', { title: 'Changed' });
    expect(repository.archiveList).toHaveBeenCalledWith('l1');
    expect(repository.deleteList).toHaveBeenCalledWith('l1');
    expect(repository.restoreList).toHaveBeenCalledWith('l1');
  });

  it('rejects malformed and unknown commands before they reach persistence', async () => {
    const deliver = createTodoRemoteMutationDelivery({} as any);
    await expect(deliver(entry('task.update', { taskId: 1 }))).rejects.toThrow('Invalid durable sync command payload');
    await expect(deliver(entry('unknown', {}))).rejects.toThrow('Unsupported durable sync command');
  });
});
