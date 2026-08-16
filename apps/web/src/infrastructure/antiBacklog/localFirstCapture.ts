import type { ParsedCapture } from '../../core/domain/antiBacklog';
import { createIndexedDbDurableQueueStore, createMemoryDurableQueueStore, type DurableQueueStore } from '../persistence/durableQueueStore';

const DATABASE_NAME = 'task-laureate-anti-backlog';
const DATABASE_VERSION = 1;
const OUTBOX_STORE = 'outbox';

export interface OutboxItem<T = unknown> {
  id: string;
  type: 'capture';
  payload: T;
  idempotencyKey: string;
  createdAt: string;
  attempts: number;
  lastError: string | null;
}

export interface CaptureOutboxPayload {
  rawInput: string;
  parsed: ParsedCapture;
  /** null means the frictionless default Inbox; a list ID is an explicit choice. */
  listId: string | null;
}

export interface OutboxStore {
  enqueue(item: OutboxItem): Promise<void>;
  list(): Promise<OutboxItem[]>;
  acknowledge(id: string): Promise<void>;
  recordFailure(id: string, error: string): Promise<void>;
}

function asCaptureOutbox(store: DurableQueueStore<OutboxItem>): OutboxStore {
  return {
    async enqueue(item) { await store.put(item); },
    async list() { return store.list(); },
    async acknowledge(id) { await store.remove(id); },
    async recordFailure(id, error) { await store.update(id, (item) => ({ ...item, attempts: item.attempts + 1, lastError: error })); },
  };
}

/** Creates the same store shape in production browsers and in tests/SSR. */
export function createOutboxStore(): OutboxStore {
  const options = { databaseName: DATABASE_NAME, databaseVersion: DATABASE_VERSION, storeName: OUTBOX_STORE, sort: (left: OutboxItem, right: OutboxItem) => left.createdAt.localeCompare(right.createdAt) };
  return asCaptureOutbox(typeof indexedDB === 'undefined' ? createMemoryDurableQueueStore([], options.sort) : createIndexedDbDurableQueueStore(options));
}

export function createCaptureOutboxItem(rawInput: string, parsed: ParsedCapture, listId: string | null = null, now = new Date()): OutboxItem<CaptureOutboxPayload> {
  const id = crypto.randomUUID();
  return { id, type: 'capture', payload: { rawInput, parsed, listId }, idempotencyKey: `capture:${id}`, createdAt: now.toISOString(), attempts: 0, lastError: null };
}

/**
 * Delivery is explicitly at-least-once. Idempotency keys make repeated sends
 * safe when a browser loses connectivity after a server has accepted a write.
 */
export async function flushOutbox(
  store: OutboxStore,
  deliver: (item: OutboxItem) => Promise<void>,
): Promise<{ delivered: number; failed: number }> {
  let delivered = 0;
  let failed = 0;
  for (const item of await store.list()) {
    try {
      await deliver(item);
      await store.acknowledge(item.id);
      delivered += 1;
    } catch (error) {
      await store.recordFailure(item.id, error instanceof Error ? error.message : 'Unknown delivery failure');
      failed += 1;
    }
  }
  return { delivered, failed };
}
