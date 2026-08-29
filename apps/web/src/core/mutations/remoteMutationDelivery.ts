import { supportsIdempotentCreation, type TodoListInput, type TodoListUpdateInput, type TodoRepository, type TodoTaskInput, type TodoTaskUpdateInput } from '../contracts/repository';
import type { PendingMutation } from '../../infrastructure/antiBacklog/mutationOutbox';

type TaskUpdatePayload = { taskId: string; input: TodoTaskUpdateInput };
type CompletePayload = { taskId: string; isComplete: boolean };
type TaskIdPayload = { taskId: string };
type ListUpdatePayload = { listId: string; input: TodoListUpdateInput };
type ListIdPayload = { listId: string };
type TaskCreatePayload = { input: TodoTaskInput };
type ListCreatePayload = { input: TodoListInput };

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function taskUpdate(value: unknown): TaskUpdatePayload | null {
  const payload = object(value);
  return payload && typeof payload.taskId === 'string' && object(payload.input) ? payload as TaskUpdatePayload : null;
}

function taskCompletion(value: unknown): CompletePayload | null {
  const payload = object(value);
  return payload && typeof payload.taskId === 'string' && typeof payload.isComplete === 'boolean' ? payload as CompletePayload : null;
}

function taskId(value: unknown): TaskIdPayload | null {
  const payload = object(value);
  return payload && typeof payload.taskId === 'string' ? payload as TaskIdPayload : null;
}

function listUpdate(value: unknown): ListUpdatePayload | null {
  const payload = object(value);
  return payload && typeof payload.listId === 'string' && object(payload.input) ? payload as ListUpdatePayload : null;
}

function listId(value: unknown): ListIdPayload | null {
  const payload = object(value);
  return payload && typeof payload.listId === 'string' ? payload as ListIdPayload : null;
}

/**
 * Adapter/command pattern boundary: persistence transports can be replaced
 * without changing the durable journal. Commands contain final desired state,
 * making replay safe for the current Supabase PATCH-based repository.
 */
export function createTodoRemoteMutationDelivery(repository: TodoRepository) {
  return async (entry: PendingMutation): Promise<void> => {
    switch (entry.type) {
      case 'task.create': { const payload = object(entry.payload) as TaskCreatePayload | null; if (!payload?.input || !supportsIdempotentCreation(repository)) break; await repository.createTaskIdempotent(payload.input, entry.idempotencyKey); return; }
      case 'list.create': { const payload = object(entry.payload) as ListCreatePayload | null; if (!payload?.input || !supportsIdempotentCreation(repository)) break; await repository.createListIdempotent(payload.input, entry.idempotencyKey); return; }
      case 'task.update': { const payload = taskUpdate(entry.payload); if (!payload) break; await repository.updateTask(payload.taskId, payload.input); return; }
      case 'task.complete': { const payload = taskCompletion(entry.payload); if (!payload) break; await repository.completeTask(payload.taskId, payload.isComplete); return; }
      case 'task.delete': { const payload = taskId(entry.payload); if (!payload) break; await repository.deleteTask(payload.taskId); return; }
      case 'task.restore': { const payload = taskId(entry.payload); if (!payload) break; await repository.restoreTask(payload.taskId); return; }
      case 'list.update': { const payload = listUpdate(entry.payload); if (!payload) break; await repository.updateList(payload.listId, payload.input); return; }
      case 'list.archive': { const payload = listId(entry.payload); if (!payload) break; await repository.archiveList(payload.listId); return; }
      case 'list.delete': { const payload = listId(entry.payload); if (!payload) break; await repository.deleteList(payload.listId); return; }
      case 'list.restore': { const payload = listId(entry.payload); if (!payload) break; await repository.restoreList(payload.listId); return; }
      default: throw new Error(`Unsupported durable sync command: ${entry.type}`);
    }
    throw new Error(`Invalid durable sync command payload: ${entry.type}`);
  };
}
