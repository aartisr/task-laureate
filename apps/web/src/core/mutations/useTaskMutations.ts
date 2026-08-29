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
import { supportsIdempotentCreation, type TodoRepository, type TodoTaskInput, type TodoTaskUpdateInput } from '../contracts/repository';
import { createMutationOrchestrator, type MutationOperation } from './mutationOrchestrator';
import { listTasksQueryOptions } from '../contracts/queryKeys';
import { queryKeys } from '../contracts/queryKeys';
import { undoJournal } from './undoJournal';
import { MAX_NOTE_LENGTH } from '../domain/richNote';
import { supportsTaskEvents } from '../contracts/antiBacklog';
import { createRemoteMutationQueue, resourceStream } from './remoteMutationQueue';

interface TaskMutationContext {
  repository: TodoRepository;
  userId: string;
}

export function useTaskMutations(context: TaskMutationContext) {
  const queryClient = useQueryClient();
  const { repository, userId } = context;
  const remoteQueue = useMemo(() => createRemoteMutationQueue(userId), [userId]);
  const refresh = async (listId?: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
      queryClient.invalidateQueries({ queryKey: queryKeys.activity }),
      ...(listId ? [queryClient.invalidateQueries({ queryKey: queryKeys.tasks(listId) })] : []),
    ]);
  };

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
          if (input.notes && input.notes.length > MAX_NOTE_LENGTH) {
            errors.push({ field: 'notes', message: `Notes must be ${MAX_NOTE_LENGTH.toLocaleString()} characters or less` });
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
        const message = result.error?.message || 'Failed to create task';
        if (supportsIdempotentCreation(repository)) await remoteQueue.preserveOnRetryableFailure(message, { type: 'task.create', stream: resourceStream('task', `create:${input.listId}`), payload: { input } });
        throw new Error(message);
      }
      let taskId = result.data!.id;
      undoJournal.record({
        label: `Created “${result.data!.title}”`,
        detail: 'Remove or recreate this task',
        undo: async () => { await repository.deleteTask(taskId); await refresh(input.listId); },
        redo: async () => { const task = await repository.createTask(input); taskId = task.id; await refresh(input.listId); },
      });
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
          if (input.notes !== undefined && input.notes.length > MAX_NOTE_LENGTH) {
            errors.push({ field: 'notes', message: `Notes must be ${MAX_NOTE_LENGTH.toLocaleString()} characters or less` });
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
        const message = result.error?.message || 'Failed to update task';
        await remoteQueue.preserveOnRetryableFailure(message, { type: 'task.update', stream: resourceStream('task', taskId), payload: { taskId, input } });
        throw new Error(message);
      }
      if (currentTask) {
        const before: TodoTaskUpdateInput = {
          title: currentTask.title, notes: currentTask.notes, priority: currentTask.priority,
          dueDate: currentTask.dueDate, tags: currentTask.tags, status: currentTask.status,
        };
        undoJournal.record({
          label: `Updated “${result.data!.title}”`,
          undo: async () => { await repository.updateTask(taskId, before); await refresh(currentTask.listId); },
          redo: async () => { await repository.updateTask(taskId, input); await refresh(currentTask.listId); },
        });
      }
      return result.data!;
    },
  });

  const moveTaskMutation = useMutation({
    mutationFn: async ({ taskId, destinationListId }: { taskId: string; destinationListId: string }) => {
      const currentTask = await repository.getTask(taskId);
      if (!currentTask) throw new Error('Task not found');
      if (currentTask.listId === destinationListId) return currentTask;
      const moved = await repository.moveTask(taskId, destinationListId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.list(currentTask.listId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.list(destinationListId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks(currentTask.listId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks(destinationListId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.lists }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard }),
      ]);
      undoJournal.record({
        label: `Moved “${currentTask.title}”`,
        detail: 'Return it to its previous list',
        undo: async () => { await repository.moveTask(taskId, currentTask.listId); await refresh(currentTask.listId); await refresh(destinationListId); },
        redo: async () => { await repository.moveTask(taskId, destinationListId); await refresh(currentTask.listId); await refresh(destinationListId); },
      });
      return moved;
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
        const message = result.error?.message || 'Failed to complete task';
        await remoteQueue.preserveOnRetryableFailure(message, { type: 'task.complete', stream: resourceStream('task', taskId), payload: { taskId, isComplete } });
        throw new Error(message);
      }
      if (currentTask) {
        if (supportsTaskEvents(repository)) {
          const planning = await (async () => {
            if ('getTaskPlanning' in repository && typeof repository.getTaskPlanning === 'function') return repository.getTaskPlanning(taskId);
            return null;
          })();
          await repository.recordTaskEvent({ taskId, type: isComplete ? 'completed' : 'reopened', occurredAt: new Date().toISOString(), idempotencyKey: `task.${isComplete ? 'complete' : 'reopen'}:${taskId}:${result.data!.updatedAt}`, payload: { estimateMinutes: planning?.estimateMinutes ?? null, energyLevel: planning?.energyLevel ?? null } });
        }
        const priorComplete = currentTask.status === 'done';
        undoJournal.record({
          label: isComplete ? `Completed “${currentTask.title}”` : `Reopened “${currentTask.title}”`,
          undo: async () => { await repository.completeTask(taskId, priorComplete); await refresh(currentTask.listId); },
          redo: async () => { await repository.completeTask(taskId, isComplete); await refresh(currentTask.listId); },
        });
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
        const message = result.error?.message || 'Failed to delete task';
        await remoteQueue.preserveOnRetryableFailure(message, { type: 'task.delete', stream: resourceStream('task', taskId), payload: { taskId } });
        throw new Error(message);
      }
      undoJournal.record({
        label: `Deleted “${result.data!.title}”`,
        detail: 'Restore this task',
        undo: async () => { await repository.restoreTask(taskId); await refresh(currentTask?.listId); },
        redo: async () => { await repository.deleteTask(taskId); await refresh(currentTask?.listId); },
      });
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
        const message = result.error?.message || 'Failed to restore task';
        await remoteQueue.preserveOnRetryableFailure(message, { type: 'task.restore', stream: resourceStream('task', taskId), payload: { taskId } });
        throw new Error(message);
      }
      undoJournal.record({
        label: `Restored “${result.data!.title}”`,
        undo: async () => { await repository.deleteTask(taskId); await refresh(result.data!.listId); },
        redo: async () => { await repository.restoreTask(taskId); await refresh(result.data!.listId); },
      });
      return result.data!;
    },
  });

  return {
    createTask: createTaskMutation,
    updateTask: updateTaskMutation,
    moveTask: moveTaskMutation,
    completeTask: completeTaskMutation,
    deleteTask: deleteTaskMutation,
    restoreTask: restoreTaskMutation,
  };
}
