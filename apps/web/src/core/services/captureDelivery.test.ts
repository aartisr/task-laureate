import { describe, expect, it } from 'vitest';
import { createMemoryTodoRepository } from '../../infrastructure/mock/memoryRepository';
import { createEmptyWorkspace } from '../../infrastructure/persistence/workspace';
import { createCaptureOutboxItem, createOutboxStore } from '../../infrastructure/antiBacklog/localFirstCapture';
import { parseCapture } from '../domain/antiBacklog';
import { flushCaptureOutbox } from './captureDelivery';

describe('capture delivery', () => {
  it('turns a queued capture into a real task in a single Inbox', async () => {
    const repository = createMemoryTodoRepository(createEmptyWorkspace());
    const store = createOutboxStore();
    await store.enqueue(createCaptureOutboxItem('Send report #work 15m', parseCapture('Send report #work 15m')));
    await flushCaptureOutbox(store, repository);
    const lists = await repository.listLists();
    expect(lists).toHaveLength(1);
    expect(lists[0].title).toBe('Inbox');
    expect(await repository.listTasks(lists[0].id)).toMatchObject([{ title: 'Send report', tags: ['work'] }]);
    expect(await store.list()).toEqual([]);
  });
});
