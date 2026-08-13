import { describe, expect, it } from 'vitest';
import { createMemoryDurableQueueStore } from './durableQueueStore';

describe('durable queue store', () => {
  it('provides ordered, isolated records and atomic-style updates for every queue client', async () => {
    const store = createMemoryDurableQueueStore<{ id: string; createdAt: string; attempts: number }>([], (left, right) => left.createdAt.localeCompare(right.createdAt));
    await store.put({ id: 'later', createdAt: '2026-08-13T15:01:00.000Z', attempts: 0 });
    await store.put({ id: 'first', createdAt: '2026-08-13T15:00:00.000Z', attempts: 0 });
    const listed = await store.list();
    listed[0].attempts = 99;
    await store.update('first', (item) => ({ ...item, attempts: item.attempts + 1 }));
    await expect(store.list()).resolves.toEqual([
      { id: 'first', createdAt: '2026-08-13T15:00:00.000Z', attempts: 1 },
      { id: 'later', createdAt: '2026-08-13T15:01:00.000Z', attempts: 0 },
    ]);
  });
});
