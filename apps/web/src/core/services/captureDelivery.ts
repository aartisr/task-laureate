import type { TodoRepository } from '../contracts/repository';
import { supportsCaptureTask } from '../contracts/antiBacklog';
import type { ParsedCapture } from '../domain/antiBacklog';

export type CapturePayload = { rawInput: string; parsed: ParsedCapture; listId: string | null };

/** Port for durable capture storage. Browser and test implementations live in infrastructure. */
export interface CaptureOutboxItem<T = unknown> {
  id: string;
  type: 'capture';
  payload: T;
  idempotencyKey: string;
  createdAt: string;
  attempts: number;
  lastError: string | null;
}

export interface CaptureOutboxStore {
  enqueue(item: CaptureOutboxItem): Promise<void>;
  list(): Promise<CaptureOutboxItem[]>;
  acknowledge(id: string): Promise<void>;
  recordFailure(id: string, error: string): Promise<void>;
}

function isCapture(item: CaptureOutboxItem): item is CaptureOutboxItem<CapturePayload> {
  return item.type === 'capture' && typeof (item.payload as Partial<CapturePayload>).rawInput === 'string';
}

async function captureIntoLocalInbox(repository: TodoRepository, item: CaptureOutboxItem<CapturePayload>) {
  const requestedList = item.payload.listId;
  const lists = await repository.listLists();
  const inbox = requestedList ? lists.find((list) => list.id === requestedList) : lists.find((list) => list.title === 'Inbox' && list.status === 'active');
  const destination = inbox ?? await repository.createList({ title: 'Inbox', description: 'Fast capture inbox' });
  
  const parsed = item.payload.parsed;
  if (parsed.isMultiLine && parsed.individualItems && parsed.individualItems.length > 1) {
    const createdTasks = [];
    for (const subItem of parsed.individualItems) {
      if (!subItem.title) continue;
      const created = await repository.createTask({
        listId: destination.id,
        title: subItem.title,
        tags: subItem.tags,
        priority: subItem.priority ?? 'medium',
        dueDate: subItem.scheduledStartAt ? subItem.scheduledStartAt.slice(0, 10) : undefined,
      });
      createdTasks.push(created);
    }
    return createdTasks[0];
  }

  return repository.createTask({
    listId: destination.id,
    title: parsed.title,
    tags: parsed.tags,
    priority: parsed.priority ?? 'medium',
    dueDate: parsed.scheduledStartAt ? parsed.scheduledStartAt.slice(0, 10) : undefined,
  });
}

/** One place owns capture delivery semantics for local and remote repositories. */
export async function flushCaptureOutbox(store: CaptureOutboxStore, repository: TodoRepository) {
  let delivered = 0;
  let failed = 0;
  for (const item of await store.list()) {
    try {
      if (!isCapture(item)) throw new Error('Outbox item is not a valid capture.');
      if (supportsCaptureTask(repository)) await repository.captureTask({ idempotencyKey: item.idempotencyKey, rawInput: item.payload.rawInput, parsed: item.payload.parsed, listId: item.payload.listId });
      else await captureIntoLocalInbox(repository, item);
      await store.acknowledge(item.id);
      delivered += 1;
    } catch (error) {
      await store.recordFailure(item.id, error instanceof Error ? error.message : 'Unknown delivery failure');
      failed += 1;
    }
  }
  return { delivered, failed };
}
