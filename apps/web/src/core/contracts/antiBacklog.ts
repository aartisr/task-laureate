import type { TodoItem } from './domain';
import type { DecompositionSource, DecompositionStep, ParsedCapture, TaskPlanProposal, TaskPlanningMetadata } from '../domain/antiBacklog';

/** Capability contracts keep product workflows independent of persistence and vendors. */
export interface CaptureRepository {
  saveCaptureIntent(input: { rawInput: string; parsed: ParsedCapture; createdAt: string }): Promise<{ id: string }>;
}

/** Atomic capture-to-task delivery when a persistence provider supports it. */
export interface CaptureTaskRepository {
  captureTask(input: { idempotencyKey: string; rawInput: string; parsed: ParsedCapture; listId?: string | null }): Promise<TodoItem>;
}

export function supportsCaptureTask(repository: unknown): repository is CaptureTaskRepository {
  return typeof repository === 'object' && repository !== null && 'captureTask' in repository && typeof (repository as { captureTask?: unknown }).captureTask === 'function';
}

export interface TaskPlanningRepository {
  getTaskPlanning(taskId: string): Promise<TaskPlanningMetadata | null>;
  saveTaskPlanning(taskId: string, metadata: TaskPlanningMetadata): Promise<TaskPlanningMetadata>;
  saveAcceptedSteps(taskId: string, steps: DecompositionStep[], origin?: DecompositionSource): Promise<void>;
}

export interface TaskEventRepository {
  recordTaskEvent(input: { taskId: string; type: string; occurredAt: string; idempotencyKey: string; payload?: Record<string, unknown> }): Promise<void>;
}

export function supportsTaskEvents(repository: unknown): repository is TaskEventRepository {
  return typeof repository === 'object' && repository !== null && 'recordTaskEvent' in repository && typeof (repository as { recordTaskEvent?: unknown }).recordTaskEvent === 'function';
}

export interface TaskDecomposer {
  propose(task: Pick<TodoItem, 'id' | 'title' | 'notes'>): Promise<TaskPlanProposal>;
}

export interface CalendarSyncProvider {
  createOrUpdateTaskBlock(input: { taskId: string; title: string; startsAt: string; durationMinutes: number }): Promise<{ externalEventId: string; revision: string }>;
  disconnect(): Promise<void>;
}
