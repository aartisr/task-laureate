import { describe, expect, it, vi } from 'vitest';
import { createRemoteMutationEntry, createRemoteMutationQueue, resourceStream } from './remoteMutationQueue';

describe('remote mutation queue factory', () => {
  it('creates one durable, idempotent entry shape for every mutation surface', () => {
    const entry = createRemoteMutationEntry('person-1', { type: 'task.update', stream: resourceStream('task', 'task-1'), payload: { taskId: 'task-1' } }, { createId: () => 'command-1', now: () => new Date('2026-08-13T15:00:00.000Z') });
    expect(entry).toEqual(expect.objectContaining({ id: 'command-1', scope: 'person-1', stream: 'task:task-1', idempotencyKey: 'task.update:task:task-1:command-1', state: 'pending' }));
  });

  it('shares retryable failure policy across all callers', async () => {
    const enqueue = vi.fn(async () => undefined);
    const queue = createRemoteMutationQueue('person-1', { enqueue }, { createId: () => 'command-1' });
    await expect(queue.preserveOnRetryableFailure(new Error('network unavailable'), { type: 'list.update', stream: 'list:list-1', payload: { listId: 'list-1' } })).resolves.toBe(true);
    await expect(queue.preserveOnRetryableFailure(new Error('403 permission denied'), { type: 'list.update', stream: 'list:list-1', payload: { listId: 'list-1' } })).resolves.toBe(false);
    expect(enqueue).toHaveBeenCalledTimes(1);
  });
});
