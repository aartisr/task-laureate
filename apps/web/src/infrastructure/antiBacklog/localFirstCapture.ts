import type { ParsedCapture } from '../../core/domain/antiBacklog';

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
}

export interface OutboxStore {
  enqueue(item: OutboxItem): Promise<void>;
  list(): Promise<OutboxItem[]>;
  acknowledge(id: string): Promise<void>;
  recordFailure(id: string, error: string): Promise<void>;
}

function request<T>(value: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    value.onsuccess = () => resolve(value.result);
    value.onerror = () => reject(value.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
  });
}

class MemoryOutboxStore implements OutboxStore {
  private readonly items = new Map<string, OutboxItem>();

  async enqueue(item: OutboxItem) { this.items.set(item.id, structuredClone(item)); }
  async list() { return [...this.items.values()].map((item) => structuredClone(item)).sort((a, b) => a.createdAt.localeCompare(b.createdAt)); }
  async acknowledge(id: string) { this.items.delete(id); }
  async recordFailure(id: string, error: string) {
    const item = this.items.get(id);
    if (item) this.items.set(id, { ...item, attempts: item.attempts + 1, lastError: error });
  }
}

class IndexedDbOutboxStore implements OutboxStore {
  private readonly database: Promise<IDBDatabase>;

  constructor() {
    this.database = new Promise((resolve, reject) => {
      const open = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      open.onupgradeneeded = () => {
        if (!open.result.objectStoreNames.contains(OUTBOX_STORE)) open.result.createObjectStore(OUTBOX_STORE, { keyPath: 'id' });
      };
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error ?? new Error('Unable to open IndexedDB'));
    });
  }

  async enqueue(item: OutboxItem) {
    const db = await this.database;
    const tx = db.transaction(OUTBOX_STORE, 'readwrite');
    tx.objectStore(OUTBOX_STORE).put(item);
    await transactionDone(tx);
  }

  async list() {
    const db = await this.database;
    const tx = db.transaction(OUTBOX_STORE, 'readonly');
    const items = await request(tx.objectStore(OUTBOX_STORE).getAll()) as OutboxItem[];
    await transactionDone(tx);
    return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async acknowledge(id: string) {
    const db = await this.database;
    const tx = db.transaction(OUTBOX_STORE, 'readwrite');
    tx.objectStore(OUTBOX_STORE).delete(id);
    await transactionDone(tx);
  }

  async recordFailure(id: string, error: string) {
    const db = await this.database;
    const tx = db.transaction(OUTBOX_STORE, 'readwrite');
    const store = tx.objectStore(OUTBOX_STORE);
    const item = await request(store.get(id)) as OutboxItem | undefined;
    if (item) store.put({ ...item, attempts: item.attempts + 1, lastError: error });
    await transactionDone(tx);
  }
}

/** Creates the same store shape in production browsers and in tests/SSR. */
export function createOutboxStore(): OutboxStore {
  return typeof indexedDB === 'undefined' ? new MemoryOutboxStore() : new IndexedDbOutboxStore();
}

export function createCaptureOutboxItem(rawInput: string, parsed: ParsedCapture, now = new Date()): OutboxItem<CaptureOutboxPayload> {
  const id = crypto.randomUUID();
  return { id, type: 'capture', payload: { rawInput, parsed }, idempotencyKey: `capture:${id}`, createdAt: now.toISOString(), attempts: 0, lastError: null };
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
