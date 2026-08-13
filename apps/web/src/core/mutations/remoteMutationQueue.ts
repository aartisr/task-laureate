import { remoteSync, shouldQueueRemoteMutation, type DurableRemoteSync, type PendingMutation } from '../../infrastructure/antiBacklog/mutationOutbox';

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
  sync: Pick<DurableRemoteSync, 'enqueue'> = remoteSync,
  dependencies: QueueDependencies = {},
) {
  const enqueue = async <TPayload>(command: RemoteMutationCommand<TPayload>) => {
    await sync.enqueue(createRemoteMutationEntry(scope, command, dependencies));
  };

  return {
    enqueue,
    async preserveOnRetryableFailure<TPayload>(error: unknown, command: RemoteMutationCommand<TPayload>) {
      if (!shouldQueueRemoteMutation(error)) return false;
      await enqueue(command);
      return true;
    },
  };
}

export function resourceStream(kind: 'task' | 'list', id: string) {
  return `${kind}:${id}`;
}
