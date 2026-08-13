import { describe, expect, it } from 'vitest';
import { DurableRemoteSync, classifyDeliveryFailure, createMemoryMutationOutbox, retryDelayMs, type PendingMutation } from './mutationOutbox';

const now = new Date('2026-08-13T15:00:00.000Z');
const item = (id: string, overrides: Partial<PendingMutation> = {}): PendingMutation => ({
  id, type: 'task.update', payload: { taskId: id }, idempotencyKey: `key:${id}`,
  createdAt: new Date(now.getTime() + Number(id.replace(/\D/g, '') || 0)).toISOString(), state: 'pending', stream: `task:${id}`, scope: 'person-1', ...overrides,
});

async function syncWith(store = createMemoryMutationOutbox(), online = () => true) {
  const sync = new DurableRemoteSync({ outbox: store, now: () => now, isOnline: online, random: () => .5, maxParallelStreams: 4 });
  sync.setScope('person-1');
  return { sync, store };
}

describe('durable remote sync', () => {
  it('keeps serializable entries across coordinator recreation', async () => {
    const store = createMemoryMutationOutbox();
    await store.enqueue(item('1'));
    const { sync } = await syncWith(store);
    const delivered: string[] = [];
    sync.setDelivery(async (entry) => { delivered.push(entry.id); });
    await sync.flush();
    expect(delivered).toEqual(['1']);
    await expect(store.list()).resolves.toEqual([]);
  });

  it('preserves FIFO order within a resource stream', async () => {
    const { sync, store } = await syncWith();
    await store.enqueue(item('1', { stream: 'task:shared' }));
    await store.enqueue(item('2', { stream: 'task:shared' }));
    const delivered: string[] = [];
    sync.setDelivery(async (entry) => { delivered.push(entry.id); });
    await sync.flush();
    expect(delivered).toEqual(['1', '2']);
  });

  it('replays independent resource streams concurrently without duplicating entries', async () => {
    const { sync, store } = await syncWith();
    await store.enqueue(item('1', { stream: 'task:a' }));
    await store.enqueue(item('2', { stream: 'task:b' }));
    let active = 0; let peak = 0; const delivered: string[] = [];
    sync.setDelivery(async (entry) => { active += 1; peak = Math.max(peak, active); await Promise.resolve(); delivered.push(entry.id); active -= 1; });
    await Promise.all([sync.flush(), sync.flush(), sync.flush()]);
    expect(peak).toBe(2);
    expect(delivered.sort()).toEqual(['1', '2']);
  });

  it('never sends while offline and automatically retains the local intent', async () => {
    const { sync, store } = await syncWith(undefined, () => false);
    await store.enqueue(item('1'));
    let calls = 0;
    sync.setDelivery(async () => { calls += 1; });
    await sync.flush();
    expect(calls).toBe(0);
    expect((await store.list())[0]).toMatchObject({ state: 'pending', idempotencyKey: 'key:1' });
  });

  it('keeps the idempotency key while scheduling a jittered transient retry', async () => {
    const { sync, store } = await syncWith();
    sync.setDelivery(async () => { throw new Error('Failed to fetch'); });
    await sync.enqueue(item('1'));
    await sync.flush();
    const saved = (await store.list())[0];
    expect(saved).toMatchObject({ state: 'retrying', attempts: 1, idempotencyKey: 'key:1', error: 'Failed to fetch' });
    expect(saved.nextAttemptAt).toBe(new Date(now.getTime() + 1_000).toISOString());
  });

  it('quarantines conflict and authorization failures instead of retrying forever', async () => {
    const { sync, store } = await syncWith();
    await store.enqueue(item('1', { stream: 'task:conflict' }));
    await store.enqueue(item('2', { stream: 'task:forbidden' }));
    sync.setDelivery(async (entry) => { throw new Error(entry.id === '1' ? '409 version conflict' : '403 permission denied'); });
    await sync.flush({ force: true });
    expect(await store.list()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: '1', state: 'conflict', nextAttemptAt: null }),
      expect.objectContaining({ id: '2', state: 'blocked', nextAttemptAt: null }),
    ]));
  });

  it('does not allow an account to deliver another account’s journal entries', async () => {
    const { sync, store } = await syncWith();
    await store.enqueue(item('1', { scope: 'person-2' }));
    let calls = 0;
    sync.setDelivery(async () => { calls += 1; });
    await sync.flush({ force: true });
    expect(calls).toBe(0);
    expect(await store.list()).toHaveLength(1);
  });

  it('reclaims an interrupted in-flight write when the coordinator starts', async () => {
    const store = createMemoryMutationOutbox([item('1', { state: 'inflight' })]);
    const { sync } = await syncWith(store);
    sync.setDelivery(async () => undefined);
    await sync.flush({ force: true });
    await expect(store.list()).resolves.toEqual([]);
  });

  it('classifies failures and caps retry delay predictably', () => {
    expect(classifyDeliveryFailure(new Error('409 conflict'))).toBe('conflict');
    expect(classifyDeliveryFailure(new Error('401 sign in'))).toBe('blocked');
    expect(classifyDeliveryFailure(new Error('network down'))).toBe('retry');
    expect(retryDelayMs(1, () => .5)).toBe(1_000);
    expect(retryDelayMs(99, () => .5)).toBe(300_000);
  });
});
