import { describe, expect, it } from 'vitest';
import { createMemoryMutationOutbox, reconcileMutations } from './mutationOutbox';
describe('mutation reconciliation', () => it('surfaces only true conflicts', async () => { const outbox = createMemoryMutationOutbox(); await outbox.enqueue({ id: '1', type: 'task.update', payload: {}, idempotencyKey: 'x', createdAt: '', state: 'pending' }); await reconcileMutations(outbox, async () => { throw new Error('409 version conflict'); }); await expect(outbox.list()).resolves.toMatchObject([{ state: 'conflict' }]); }));
