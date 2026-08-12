import { describe, expect, it } from 'vitest';
import { createCaptureOutboxItem, createOutboxStore, flushOutbox } from './localFirstCapture';
import { parseCapture } from '../../core/domain/antiBacklog';

describe('local-first capture outbox', () => {
  it('keeps a capture durable until a successful delivery acknowledges it', async () => {
    const store = createOutboxStore();
    const item = createCaptureOutboxItem('Send report #work 10m', parseCapture('Send report #work 10m'));
    await store.enqueue(item);
    const first = await flushOutbox(store, async () => { throw new Error('Offline'); });
    expect(first).toEqual({ delivered: 0, failed: 1 });
    expect(await store.list()).toMatchObject([{ id: item.id, attempts: 1, lastError: 'Offline' }]);
    const received: string[] = [];
    const second = await flushOutbox(store, async (pending) => { received.push(pending.idempotencyKey); });
    expect(second).toEqual({ delivered: 1, failed: 0 });
    expect(received).toEqual([item.idempotencyKey]);
    expect(await store.list()).toEqual([]);
  });
});
