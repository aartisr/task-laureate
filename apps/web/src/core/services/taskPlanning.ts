import type { TodoRepository } from '../contracts/repository';
import type { TaskPlanningRepository } from '../contracts/antiBacklog';
import { needsClarity, type TaskPlanningMetadata } from '../domain/antiBacklog';
import type { DecompositionSource, DecompositionStep } from '../domain/antiBacklog';

const storageKey = 'task-laureate.task-planning.v1';

function supportsTaskPlanning(repository: TodoRepository): repository is TodoRepository & TaskPlanningRepository {
  return 'getTaskPlanning' in repository && 'saveTaskPlanning' in repository && 'saveAcceptedSteps' in repository;
}

function readLocal(): Record<string, TaskPlanningMetadata> {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(window.localStorage.getItem(storageKey) ?? '{}') as Record<string, TaskPlanningMetadata>; } catch { return {}; }
}

function writeLocal(value: Record<string, TaskPlanningMetadata>) {
  if (typeof window !== 'undefined') window.localStorage.setItem(storageKey, JSON.stringify(value));
}

/**
 * Anti-corruption layer between the UI and either remote planning persistence
 * or a durable browser-local fallback. The UI never needs to branch by driver.
 */
export function createTaskPlanningService(repository: TodoRepository) {
  return {
    async get(taskId: string): Promise<TaskPlanningMetadata> {
      if (supportsTaskPlanning(repository)) {
        return await repository.getTaskPlanning(taskId) ?? { estimateMinutes: null, energyLevel: null, scheduledStartAt: null, parentTaskId: null, needsClarity: true };
      }
      return readLocal()[taskId] ?? { estimateMinutes: null, energyLevel: null, scheduledStartAt: null, parentTaskId: null, needsClarity: true };
    },
    async save(taskId: string, value: Omit<TaskPlanningMetadata, 'needsClarity'>): Promise<TaskPlanningMetadata> {
      const metadata = { ...value, needsClarity: needsClarity(value) };
      if (supportsTaskPlanning(repository)) return repository.saveTaskPlanning(taskId, metadata);
      writeLocal({ ...readLocal(), [taskId]: metadata });
      return metadata;
    },
    async acceptSteps(taskId: string, steps: DecompositionStep[], origin: DecompositionSource = 'template') {
      if (supportsTaskPlanning(repository)) await repository.saveAcceptedSteps(taskId, steps, origin);
      return steps;
    },
  };
}
