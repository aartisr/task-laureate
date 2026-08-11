import type { TodoItemStatus } from '../contracts/domain';

/**
 * Directed task graph edge. `prerequisite → dependent` is deliberately stored
 * in one canonical direction so traversal, cycle detection, and permissions
 * remain predictable across every repository implementation.
 */
export type TaskDependencyType = 'finish_to_start' | 'start_to_start' | 'finish_to_finish' | 'start_to_finish';

export interface DependencyTaskRef {
  id: string;
  title: string;
  status: TodoItemStatus;
  dueDate: string | null;
}

export interface TaskDependency {
  id: string;
  prerequisiteTask: DependencyTaskRef;
  dependentTask: DependencyTaskRef;
  type: TaskDependencyType;
  required: boolean;
  createdAt: string;
}

export interface TaskDependencySummary {
  unresolvedPrerequisiteCount: number;
  dependentCount: number;
  isReadyToComplete: boolean;
}

export const dependencyTypeLabel: Record<TaskDependencyType, string> = {
  finish_to_start: 'Finish → start',
  start_to_start: 'Start → start',
  finish_to_finish: 'Finish → finish',
  start_to_finish: 'Start → finish',
};
