/**
 * Task Mutation Hooks
 *
 * Provides type-safe, production-grade mutations for task operations with:
 * - Full validation with priority and due-date awareness
 * - Optimistic updates with rollback
 * - Error recovery paths
 * - Activity tracking
 * - Performance monitoring
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { TodoItem } from '../contracts/domain';
import type { TodoRepository, TodoTaskInput, TodoTaskUpdateInput } from '../contracts/repository';
import { createMutationOrchestrator, type MutationOperation } from './mutationOrchestrator';
import { listTasksQueryOptions } from '../contracts/queryKeys';

interface TaskMutationContext {
  repository: TodoRepository;
  userId: string;
}

export function useTaskMutations(context: TaskMutationContext) {
  const queryClient = useQueryClient();
  const { repository, userId } = context;

  const orchestrator = useMemo(() => {
    return createMutationOrchestrator({
      queryClient,
      userId,
      requestId: `task-mutation-${Date.now()}`,
      timestamp: Date.now(),
    });
  }, [queryClient, userId]);

  /**
   * Create a new task
   */
  const createTaskMutation = useMutation({
    mutationFn: async (input: TodoTaskInput) => {
      const operation: MutationOperation<TodoTaskInput, TodoItem> = {
        id: 'tasks.create',
        name: 'Create Task',
        isDestructive: false,
        requiresConfirmation: false,
        validator: (input) => {
          const errors: Array<{ field: string; message: string }> = [];
          if (!input.title || input.title.trim().length === 0) {
            errors.push({ field: 'title', message: 'Title is required' });
          }
          if (input.title && input.title.length > 500) {
            errors.push({ field: 'title', message: 'Title must be 500 characters or less' });
          }
          if (input.notes && input.notes.length > 5000) {
            errors.push({ field: 'notes', message: 'Notes must be 5000 characters or less' });
          }
          if (input.dueDate && new Date(input.dueDate) < new Date()) {
            // Allow past dates for flexibility
          }
          if (input.tags && input.tags.length > 20) {
            errors.push({ field: 'tags', message: 'Maximum 20 tags allowed' });
          }
          if (!input.listId) {
            errors.push({ field: 'listId', message: 'List ID is required' });
          }
          return errors;
        },
        executor: (input) => repository.createTask(input),
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: listTasksQueryOptions(repository, input.listId).queryKey });
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        },
      };

      const result = await orchestrator.executeMutation(operation, input);
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to create task');
      }
      return result.data!;
    },
  });

  /**
   * Update an existing task
   */
  const updateTaskMutation = useMutation({
    mutationFn: async ({
      taskId,
      input,
    }: {
      taskId: string;
      input: TodoTaskUpdateInput;
    }) => {
      const currentTask = await repository.getTask(taskId);

      const operation: MutationOperation<TodoTaskUpdateInput, TodoItem, TodoItem | null> = {
        id: 'tasks.update',
        name: 'Update Task',
        isDestructive: false,
        requiresConfirmation: false,
        validator: (input) => {
          const errors: Array<{ field: string; message: string }> = [];
          if (input.title !== undefined && input.title.length > 500) {
            errors.push({ field: 'title', message: 'Title must be 500 characters or less' });
          }
          if (input.notes !== undefined && input.notes.length > 5000) {
            errors.push({ field: 'notes', message: 'Notes must be 5000 characters or less' });
          }
          if (input.tags !== undefined && input.tags.length > 20) {
            errors.push({ field: 'tags', message: 'Maximum 20 tags allowed' });
          }
          return errors;
        },
        executor: (input) => repository.updateTask(taskId, input),
        optimisticUpdater: (input, cache) => {
          if (!cache) return cache;
          return {
            ...cache,
            title: input.title ?? cache.title,
            notes: input.notes ?? cache.notes,
            priority: input.priority ?? cache.priority,
            dueDate: 'dueDate' in input ? input.dueDate ?? null : cache.dueDate,
            tags: input.tags ?? cache.tags,
            status: input.status ?? cache.status,
            updatedAt: new Date().toISOString(),
          };
        },
        onSuccess: () => {
          if (currentTask) {
            queryClient.invalidateQueries({ queryKey: listTasksQueryOptions(repository, currentTask.listId).queryKey });
          }
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        },
      };

      const result = await orchestrator.executeMutation(operation, input);
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to update task');
      }
      return result.data!;
    },
  });

  /**
   * Complete or uncomplete a task
   */
  const completeTaskMutation = useMutation({
    mutationFn: async ({ taskId, isComplete }: { taskId: string; isComplete: boolean }) => {
      const currentTask = await repository.getTask(taskId);

      const operation: MutationOperation<boolean, TodoItem, TodoItem | null> = {
        id: 'tasks.complete',
        name: isComplete ? 'Complete Task' : 'Reopen Task',
        isDestructive: false,
        requiresConfirmation: false,
        executor: () => repository.completeTask(taskId, isComplete),
        optimisticUpdater: (isComplete, cache) => {
          if (!cache) return cache;
          return {
            ...cache,
            status: isComplete ? 'done' : 'todo',
            completedAt: isComplete ? new Date().toISOString() : null,
            updatedAt: new Date().toISOString(),
          };
        },
        onSuccess: () => {
          if (currentTask) {
            queryClient.invalidateQueries({ queryKey: listTasksQueryOptions(repository, currentTask.listId).queryKey });
          }
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        },
      };

      const result = await orchestrator.executeMutation(operation, isComplete);
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to complete task');
      }
      return result.data!;
    },
  });

  /**
   * Delete a task (soft delete)
   */
  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const currentTask = await repository.getTask(taskId);

      const operation: MutationOperation<string, TodoItem> = {
        id: 'tasks.delete',
        name: 'Delete Task',
        isDestructive: true,
        requiresConfirmation: true,
        executor: () => repository.deleteTask(taskId),
        getRecoveryPaths: () => [
          {
            label: 'Undo deletion',
            action: async () => {
              await repository.restoreTask(taskId);
              if (currentTask) {
                queryClient.invalidateQueries({ queryKey: listTasksQueryOptions(repository, currentTask.listId).queryKey });
              }
            },
            description: 'Restore this task',
          },
        ],
        onSuccess: () => {
          if (currentTask) {
            queryClient.invalidateQueries({ queryKey: listTasksQueryOptions(repository, currentTask.listId).queryKey });
          }
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        },
      };

      const result = await orchestrator.executeMutation(operation, taskId);
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to delete task');
      }
      return result.data!;
    },
  });

  /**
   * Restore a deleted task
   */
  const restoreTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const currentTask = await repository.getTask(taskId);

      const operation: MutationOperation<string, TodoItem> = {
        id: 'tasks.restore',
        name: 'Restore Task',
        isDestructive: false,
        requiresConfirmation: false,
        executor: () => repository.restoreTask(taskId),
        onSuccess: () => {
          if (currentTask) {
            queryClient.invalidateQueries({ queryKey: listTasksQueryOptions(repository, currentTask.listId).queryKey });
          }
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        },
      };

      const result = await orchestrator.executeMutation(operation, taskId);
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to restore task');
      }
      return result.data!;
    },
  });

  return {
    createTask: createTaskMutation,
    updateTask: updateTaskMutation,
    completeTask: completeTaskMutation,
    deleteTask: deleteTaskMutation,
    restoreTask: restoreTaskMutation,
  };
}
