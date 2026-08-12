/** Transport-neutral operation log for replaying optimistic browser mutations. */
export type MutationState = 'pending' | 'conflict';
export interface PendingMutation { id: string; type: string; payload: unknown; idempotencyKey: string; createdAt: string; state: MutationState; error?: string; }
export interface MutationOutbox { enqueue(item: PendingMutation): Promise<void>; list(): Promise<PendingMutation[]>; resolve(id: string): Promise<void>; conflict(id: string, error: string): Promise<void>; }

export function createMemoryMutationOutbox(): MutationOutbox {
  const items = new Map<string, PendingMutation>();
  return { async enqueue(item) { items.set(item.id, structuredClone(item)); }, async list() { return [...items.values()].map((item) => structuredClone(item)); }, async resolve(id) { items.delete(id); }, async conflict(id, error) { const item = items.get(id); if (item) items.set(id, { ...item, state: 'conflict', error }); } };
}

function openDatabase(): Promise<IDBDatabase> { return new Promise((resolve, reject) => { const request = indexedDB.open('task-laureate-operations', 1); request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('mutations')) request.result.createObjectStore('mutations', { keyPath: 'id' }); }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
/** Durable browser mutation log; memory fallback preserves SSR and test safety. */
export function createIndexedDbMutationOutbox(): MutationOutbox {
  if (typeof indexedDB === 'undefined') return createMemoryMutationOutbox();
  const db = openDatabase();
  const run = async <T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> => { const database = await db; return new Promise((resolve, reject) => { const tx = database.transaction('mutations', mode); const request = action(tx.objectStore('mutations')); if (request) { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); } tx.oncomplete = () => { if (!request) resolve(undefined); }; tx.onerror = () => reject(tx.error); }); };
  return { async enqueue(item) { await run('readwrite', (store) => store.put(item)); }, async list() { return (await run<PendingMutation[]>('readonly', (store) => store.getAll()) ?? []).sort((a, b) => a.createdAt.localeCompare(b.createdAt)); }, async resolve(id) { await run('readwrite', (store) => store.delete(id)); }, async conflict(id, error) { const items = await this.list(); const item = items.find((entry) => entry.id === id); if (item) await run('readwrite', (store) => store.put({ ...item, state: 'conflict', error })); } };
}

export const mutationOutbox = createIndexedDbMutationOutbox();

/** Only conflicts need attention; transient failures remain queued for retry. */
export async function reconcileMutations(outbox: MutationOutbox, deliver: (item: PendingMutation) => Promise<void>) {
  let delivered = 0; let conflicts = 0;
  for (const item of await outbox.list()) {
    if (item.state === 'conflict') continue;
    try { await deliver(item); await outbox.resolve(item.id); delivered++; }
    catch (error) { if (error instanceof Error && /conflict|version|409/i.test(error.message)) { await outbox.conflict(item.id, error.message); conflicts++; } }
  }
  return { delivered, conflicts };
}
