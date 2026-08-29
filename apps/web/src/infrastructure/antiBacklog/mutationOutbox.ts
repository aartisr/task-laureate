import { createIndexedDbDurableQueueStore, createMemoryDurableQueueStore } from '../persistence/durableQueueStore';

/**
 * Durable, local-first command journal for remote writes.
 *
 * Entries are intentionally serializable: a page reload can recreate the
 * delivery function and continue with exactly the same idempotency key. The
 * journal is at-least-once; remote command handlers must therefore treat that
 * key as stable and safe to replay.
 */
export type MutationState = 'pending' | 'retrying' | 'inflight' | 'conflict' | 'blocked';

export interface PendingMutation {
  id: string;
  type: string;
  payload: unknown;
  idempotencyKey: string;
  createdAt: string;
  state: MutationState;
  /** Keeps operations for the same resource in causal order. */
  stream?: string;
  /** Prevents a different signed-in account from ever delivering this entry. */
  scope?: string;
  attempts?: number;
  nextAttemptAt?: string | null;
  lastAttemptAt?: string | null;
  error?: string;
  updatedAt?: string;
}

export interface MutationOutbox {
  enqueue(item: PendingMutation): Promise<void>;
  list(): Promise<PendingMutation[]>;
  resolve(id: string): Promise<void>;
  save(item: PendingMutation): Promise<void>;
  conflict(id: string, error: string): Promise<void>;
}

const byCreation = (a: PendingMutation, b: PendingMutation) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);

export function createMemoryMutationOutbox(seed: PendingMutation[] = []): MutationOutbox {
  const store = createMemoryDurableQueueStore(seed.map(normalize), byCreation);
  return {
    async enqueue(item) { await store.put(normalize(item)); },
    async list() { return (await store.list()).map(normalize); },
    async resolve(id) { await store.remove(id); },
    async save(item) { await store.put(normalize(item)); },
    async conflict(id, error) { await store.update(id, (item) => ({ ...item, state: 'conflict', error, updatedAt: new Date().toISOString() })); },
  };
}

function normalize(item: PendingMutation): PendingMutation {
  return {
    ...item,
    stream: item.stream ?? item.type,
    attempts: item.attempts ?? 0,
    nextAttemptAt: item.nextAttemptAt ?? null,
    lastAttemptAt: item.lastAttemptAt ?? null,
    updatedAt: item.updatedAt ?? item.createdAt,
  };
}

/** IndexedDB storage in browsers; a safe non-durable implementation for SSR/tests. */
export function createIndexedDbMutationOutbox(): MutationOutbox {
  const store = createIndexedDbDurableQueueStore<PendingMutation>({ databaseName: 'task-laureate-operations', databaseVersion: 2, storeName: 'mutations', sort: byCreation });
  return {
    async enqueue(item) { await store.put(normalize(item)); },
    async list() { return (await store.list()).map(normalize); },
    async resolve(id) { await store.remove(id); },
    async save(item) { await store.put(normalize(item)); },
    async conflict(id, error) { await store.update(id, (item) => ({ ...item, state: 'conflict', error, updatedAt: new Date().toISOString() })); },
  };
}

export const mutationOutbox = createIndexedDbMutationOutbox();

export type DeliveryFailureKind = 'retry' | 'conflict' | 'blocked';
export function classifyDeliveryFailure(error: unknown): DeliveryFailureKind {
  const message = error instanceof Error ? error.message : String(error);
  if (/conflict|version|\b409\b/i.test(message)) return 'conflict';
  if (/\b400\b|\b401\b|\b403\b|\b404\b|\b422\b|validation|permission|not authorized|sign in/i.test(message)) return 'blocked';
  return 'retry';
}

export function shouldQueueRemoteMutation(error: unknown) {
  return classifyDeliveryFailure(error) !== 'blocked';
}

export function retryDelayMs(attempt: number, random = Math.random) {
  const capped = Math.min(5 * 60_000, 1_000 * 2 ** Math.max(0, attempt - 1));
  return Math.round(capped * (0.85 + random() * 0.3));
}

export interface RemoteSyncSnapshot {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  attentionCount: number;
  lastSyncedAt: string | null;
  nextRetryAt: string | null;
}

export interface DurableRemoteSyncOptions {
  outbox?: MutationOutbox;
  now?: () => Date;
  isOnline?: () => boolean;
  random?: () => number;
  maxParallelStreams?: number;
}

/**
 * A single-flight replay coordinator. It processes the first deliverable item
 * in each stream concurrently, while never reordering writes within a stream.
 */
export class DurableRemoteSync {
  private readonly outbox: MutationOutbox;
  private readonly now: () => Date;
  private readonly online: () => boolean;
  private readonly random: () => number;
  private readonly maxParallelStreams: number;
  private delivery: ((item: PendingMutation) => Promise<void>) | null = null;
  private scope: string | null = null;
  private running: Promise<RemoteSyncSnapshot> | null = null;
  private recovery: Promise<void> | null = null;
  private timer: number | null = null;
  private started = false;
  private listeners = new Set<() => void>();
  private snapshot: RemoteSyncSnapshot;

  constructor(options: DurableRemoteSyncOptions = {}) {
    this.outbox = options.outbox ?? mutationOutbox;
    this.now = options.now ?? (() => new Date());
    this.online = options.isOnline ?? (() => typeof navigator === 'undefined' || navigator.onLine);
    this.random = options.random ?? Math.random;
    this.maxParallelStreams = Math.max(1, options.maxParallelStreams ?? 4);
    this.snapshot = { isOnline: this.online(), isSyncing: false, pendingCount: 0, attentionCount: 0, lastSyncedAt: null, nextRetryAt: null };
  }

  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.snapshot;
  private publish(next: Partial<RemoteSyncSnapshot> = {}) { this.snapshot = { ...this.snapshot, isOnline: this.online(), ...next }; this.listeners.forEach((listener) => listener()); }

  setScope(scope: string | null) { this.scope = scope; void this.refresh(); }
  setDelivery(delivery: ((item: PendingMutation) => Promise<void>) | null) { this.delivery = delivery; if (delivery) this.start(); }

  start() {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
    window.addEventListener('visibilitychange', this.handleVisibility);
    const recovery = this.recoverInflight();
    this.recovery = recovery;
    void recovery.then(() => {
      if (this.recovery === recovery) this.recovery = null;
      return this.flush();
    });
  }

  stop() {
    if (!this.started || typeof window === 'undefined') return;
    this.started = false;
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    window.removeEventListener('visibilitychange', this.handleVisibility);
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
  }

  private handleOnline = () => { this.publish(); void this.flush({ force: true }); };
  private handleOffline = () => this.publish({ isSyncing: false });
  private handleVisibility = () => { if (document.visibilityState === 'visible') void this.flush(); };

  async enqueue(item: PendingMutation) {
    await this.outbox.enqueue(normalize({ ...item, scope: item.scope ?? this.scope ?? undefined }));
    await this.refresh();
    void this.flush({ force: true });
  }

  async retry(id: string) {
    const item = (await this.outbox.list()).find((entry) => entry.id === id);
    if (!item) return;
    await this.outbox.save({ ...item, state: 'pending', error: undefined, nextAttemptAt: null, updatedAt: this.now().toISOString() });
    await this.refresh();
    void this.flush({ force: true });
  }

  async dismiss(id: string) { await this.outbox.resolve(id); await this.refresh(); }

  /** Read-only current-account view for sync UI; never expose another account's journal. */
  async listCurrent() { return this.scoped(await this.outbox.list()); }

  private scoped(items: PendingMutation[]) { return items.filter((item) => this.scope !== null && item.scope === this.scope); }
  private async recoverInflight() {
    const items = this.scoped(await this.outbox.list());
    await Promise.all(items.filter((item) => item.state === 'inflight').map((item) => this.outbox.save({ ...item, state: 'retrying', nextAttemptAt: this.now().toISOString(), updatedAt: this.now().toISOString() })));
    await this.refresh();
  }

  private async refresh() {
    const items = this.scoped(await this.outbox.list());
    const next = items.filter((item) => item.state === 'retrying' && item.nextAttemptAt).map((item) => item.nextAttemptAt!).sort()[0] ?? null;
    this.publish({ pendingCount: items.filter((item) => item.state === 'pending' || item.state === 'retrying' || item.state === 'inflight').length, attentionCount: items.filter((item) => item.state === 'conflict' || item.state === 'blocked').length, nextRetryAt: next });
    this.schedule(next);
  }

  private schedule(nextRetryAt: string | null) {
    if (this.timer !== null && typeof window !== 'undefined') window.clearTimeout(this.timer);
    this.timer = null;
    if (!nextRetryAt || typeof window === 'undefined') return;
    const delay = Math.max(0, new Date(nextRetryAt).getTime() - this.now().getTime());
    this.timer = window.setTimeout(() => void this.flush(), delay + 10);
  }

  async flush(options: { force?: boolean } = {}): Promise<RemoteSyncSnapshot> {
    if (this.recovery) await this.recovery;
    if (this.running) return this.running;
    this.running = this.flushNow(options).finally(() => { this.running = null; });
    return this.running;
  }

  private async flushNow({ force = false }: { force?: boolean }): Promise<RemoteSyncSnapshot> {
    if (!this.delivery || !this.online() || this.scope === null) { await this.refresh(); return this.snapshot; }
    this.publish({ isSyncing: true });
    let deliveredAny = false;
    let allowForce = force;
    while (true) {
      const current = this.now().getTime();
      const byStream = new Map<string, PendingMutation[]>();
      for (const item of this.scoped(await this.outbox.list())) {
        const key = item.stream ?? item.type;
        byStream.set(key, [...(byStream.get(key) ?? []), item]);
      }
      const heads = [...byStream.values()].map((items) => items.sort(byCreation)[0]).filter((item): item is PendingMutation => Boolean(item))
        .filter((item) => item.state === 'pending' || (item.state === 'retrying' && (allowForce || !item.nextAttemptAt || new Date(item.nextAttemptAt).getTime() <= current)))
        .slice(0, this.maxParallelStreams);
      if (!heads.length) break;
      const outcomes = await Promise.all(heads.map((item) => this.deliver(item)));
      deliveredAny ||= outcomes.some(Boolean);
      // A forced manual retry gets one chance. This avoids a tight loop when
      // the network is still unavailable while allowing successful streams to drain.
      allowForce = false;
      if (!outcomes.some(Boolean)) break;
    }
    await this.refresh();
    this.publish({ isSyncing: false, lastSyncedAt: deliveredAny ? this.now().toISOString() : this.snapshot.lastSyncedAt });
    return this.snapshot;
  }

  private async deliver(item: PendingMutation): Promise<boolean> {
    const startedAt = this.now().toISOString();
    await this.outbox.save({ ...item, state: 'inflight', lastAttemptAt: startedAt, updatedAt: startedAt });
    try {
      await this.delivery!(item);
      await this.outbox.resolve(item.id);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const kind = classifyDeliveryFailure(error);
      const attempts = (item.attempts ?? 0) + 1;
      const now = this.now();
      await this.outbox.save({ ...item, state: kind === 'conflict' ? 'conflict' : kind === 'blocked' ? 'blocked' : 'retrying', attempts, error: message, lastAttemptAt: startedAt, nextAttemptAt: kind === 'retry' ? new Date(now.getTime() + retryDelayMs(attempts, this.random)).toISOString() : null, updatedAt: now.toISOString() });
      return false;
    }
  }
}

export const remoteSync = new DurableRemoteSync();

/** Backward-compatible one-shot reconciliation for non-UI callers. */
export async function reconcileMutations(outbox: MutationOutbox, deliver: (item: PendingMutation) => Promise<void>) {
  const sync = new DurableRemoteSync({ outbox, isOnline: () => true });
  sync.setScope('one-shot');
  const items = await outbox.list();
  await Promise.all(items.filter((item) => !item.scope).map((item) => outbox.save({ ...item, scope: 'one-shot' })));
  sync.setDelivery(deliver);
  const result = await sync.flush({ force: true });
  return { delivered: items.length - result.pendingCount - result.attentionCount, conflicts: result.attentionCount };
}
