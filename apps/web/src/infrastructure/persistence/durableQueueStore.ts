/** Small reusable IndexedDB/memory store for serializable, replayable records. */
export interface DurableQueueRecord { id: string; }

export interface DurableQueueStore<T extends DurableQueueRecord> {
  put(item: T): Promise<void>;
  list(): Promise<T[]>;
  remove(id: string): Promise<void>;
  update(id: string, updater: (item: T) => T): Promise<void>;
}

export interface DurableQueueStoreOptions<T extends DurableQueueRecord> {
  databaseName: string;
  databaseVersion: number;
  storeName: string;
  sort?: (left: T, right: T) => number;
}

const copy = <T>(value: T) => structuredClone(value);
const order = <T>(items: T[], sort?: (left: T, right: T) => number) => sort ? items.sort(sort) : items;

export function createMemoryDurableQueueStore<T extends DurableQueueRecord>(seed: T[] = [], sort?: (left: T, right: T) => number): DurableQueueStore<T> {
  const items = new Map(seed.map((item) => [item.id, copy(item)]));
  return {
    async put(item) { items.set(item.id, copy(item)); },
    async list() { return order([...items.values()].map(copy), sort); },
    async remove(id) { items.delete(id); },
    async update(id, updater) { const item = items.get(id); if (item) items.set(id, copy(updater(copy(item)))); },
  };
}

function openDatabase<T extends DurableQueueRecord>({ databaseName, databaseVersion, storeName }: DurableQueueStoreOptions<T>) {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(storeName)) request.result.createObjectStore(storeName, { keyPath: 'id' }); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error(`Unable to open ${databaseName}.`));
  });
}

export function createIndexedDbDurableQueueStore<T extends DurableQueueRecord>(options: DurableQueueStoreOptions<T>): DurableQueueStore<T> {
  if (typeof indexedDB === 'undefined') return createMemoryDurableQueueStore([], options.sort);
  const database = openDatabase(options);
  const run = async <TResult>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<TResult> | void): Promise<TResult | undefined> => {
    const db = await database;
    return await new Promise<TResult | undefined>((resolve, reject) => {
      const transaction = db.transaction(options.storeName, mode);
      const request = action(transaction.objectStore(options.storeName));
      if (request) { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }
      transaction.oncomplete = () => { if (!request) resolve(undefined); };
      transaction.onerror = () => reject(transaction.error ?? new Error('Durable queue transaction failed.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Durable queue transaction aborted.'));
    });
  };
  return {
    async put(item) { await run('readwrite', (store) => store.put(copy(item))); },
    async list() { return order((await run<T[]>('readonly', (store) => store.getAll()) ?? []).map(copy), options.sort); },
    async remove(id) { await run('readwrite', (store) => store.delete(id)); },
    async update(id, updater) {
      const db = await database;
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(options.storeName, 'readwrite');
        const store = transaction.objectStore(options.storeName);
        const request = store.get(id);
        request.onsuccess = () => { if (request.result) store.put(copy(updater(request.result as T))); };
        request.onerror = () => reject(request.error ?? new Error('Durable queue lookup failed.'));
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error ?? new Error('Durable queue transaction failed.'));
        transaction.onabort = () => reject(transaction.error ?? new Error('Durable queue transaction aborted.'));
      });
    },
  };
}
