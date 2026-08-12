import type { TodoRepository } from '../contracts/repository';
import { supportsCaptureTask } from '../contracts/antiBacklog';
import type { ParsedCapture } from '../domain/antiBacklog';
import type { OutboxItem, OutboxStore } from '../../infrastructure/antiBacklog/localFirstCapture';
import { flushOutbox } from '../../infrastructure/antiBacklog/localFirstCapture';

type CapturePayload = { rawInput: string; parsed: ParsedCapture };

function isCapture(item: OutboxItem): item is OutboxItem<CapturePayload> {
  return item.type === 'capture' && typeof (item.payload as Partial<CapturePayload>).rawInput === 'string';
}

async function captureIntoLocalInbox(repository: TodoRepository, item: OutboxItem<CapturePayload>) {
  const requestedList = (item.payload as CapturePayload & { listId?: string | null }).listId;
  const lists = await repository.listLists();
  const inbox = requestedList ? lists.find((list) => list.id === requestedList) : lists.find((list) => list.title === 'Inbox' && list.status === 'active');
  const destination = inbox ?? await repository.createList({ title: 'Inbox', description: 'Fast capture inbox' });
  return repository.createTask({ listId: destination.id, title: item.payload.parsed.title, tags: item.payload.parsed.tags });
}

/** One place owns capture delivery semantics for local and remote repositories. */
export async function flushCaptureOutbox(store: OutboxStore, repository: TodoRepository) {
  return flushOutbox(store, async (item) => {
    if (!isCapture(item)) throw new Error('Outbox item is not a valid capture.');
    if (supportsCaptureTask(repository)) {
      await repository.captureTask({ idempotencyKey: item.idempotencyKey, rawInput: item.payload.rawInput, parsed: item.payload.parsed });
      return;
    }
    await captureIntoLocalInbox(repository, item);
  });
}
