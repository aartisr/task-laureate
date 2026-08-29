export interface PendingMutation {
  id: string;
  type: string;
  payload: unknown;
  idempotencyKey: string;
  createdAt: string;
  state: 'pending' | 'retrying' | 'inflight' | 'conflict' | 'blocked';
  stream?: string;
  scope?: string;
}

export interface RemoteMutationSync {
  enqueue(item: PendingMutation): Promise<void>;
}

export type RetryableMutationPolicy = (error: unknown) => boolean;

let defaultSync: RemoteMutationSync | null = null;
let defaultRetryablePolicy: RetryableMutationPolicy = isRetryableRemoteMutation;

/** Composition-root registration keeps core mutation semantics independent of the storage adapter. */
export function configureRemoteMutationQueue(sync: RemoteMutationSync, isRetryable: RetryableMutationPolicy) {
  defaultSync = sync;
  defaultRetryablePolicy = isRetryable;
}

/** Transport-neutral retry policy. Infrastructure may supply a richer policy at composition time. */
export function isRetryableRemoteMutation(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return !/\b400\b|\b401\b|\b403\b|\b404\b|\b422\b|validation|permission|not authorized|sign in/i.test(message);
}

export interface RemoteMutationCommand<TPayload = unknown> {
  type: string;
  stream: string;
  payload: TPayload;
}

interface QueueDependencies {
  now?: () => Date;
  createId?: () => string;
}

/** Creates the serializable intent shared by every remote mutation surface. */
export function createRemoteMutationEntry<TPayload>(
  scope: string,
  command: RemoteMutationCommand<TPayload>,
  dependencies: QueueDependencies = {},
): PendingMutation {
  const createId = dependencies.createId ?? (() => crypto.randomUUID());
  const id = createId();
  return {
    id,
    type: command.type,
    stream: command.stream,
    payload: command.payload,
    scope,
    // This key is generated once and persisted with the intent; replay never
    // creates another key for the same command.
    idempotencyKey: `${command.type}:${command.stream}:${id}`,
    createdAt: (dependencies.now ?? (() => new Date()))().toISOString(),
    state: 'pending',
  };
}

/** A reusable policy boundary for hooks, menus, keyboard actions, and future plugins. */
export function createRemoteMutationQueue(
  scope: string,
  sync: RemoteMutationSync = defaultSync ?? missingRemoteSync(),
  dependencies: QueueDependencies = {},
  isRetryable: RetryableMutationPolicy = defaultRetryablePolicy,
) {
  const enqueue = async <TPayload>(command: RemoteMutationCommand<TPayload>) => {
    await sync.enqueue(createRemoteMutationEntry(scope, command, dependencies));
  };

  return {
    enqueue,
    async preserveOnRetryableFailure<TPayload>(error: unknown, command: RemoteMutationCommand<TPayload>) {
      if (!isRetryable(error)) return false;
      await enqueue(command);
      return true;
    },
  };
}

function missingRemoteSync(): RemoteMutationSync {
  return { enqueue: async () => { throw new Error('Remote mutation queue has not been configured.'); } };
}

export function resourceStream(kind: 'task' | 'list', id: string) {
  return `${kind}:${id}`;
}
