/**
 * List Mutation Hooks
 *
 * Provides type-safe, production-grade mutations for list operations with:
 * - Full validation
 * - Optimistic updates with rollback
 * - Error recovery paths
 * - Activity tracking
 * - Performance monitoring
 */

import { useMutation, useQueryClient, type MutationOptions } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { TodoList, TodoListStatus } from '../contracts/domain';
import type { TodoRepository, TodoListInput, TodoListUpdateInput } from '../contracts/repository';
import { createMutationOrchestrator, type MutationOperation } from './mutationOrchestrator';
import { listQueryOptions } from '../contracts/queryKeys';

interface ListMutationContext {
  repository: TodoRepository;
  userId: string;
}

export function useListMutations(context: ListMutationContext) {
  const queryClient = useQueryClient();
  const { repository, userId } = context;

  const orchestrator = useMemo(() => {
    return createMutationOrchestrator({
      queryClient,
      userId,
      requestId: `list-mutation-${Date.now()}`,
      timestamp: Date.now(),
    });
  }, [queryClient, userId]);

  /**
   * Create a new list
   */
  const createListMutation = useMutation({
    mutationFn: async (input: TodoListInput) => {
      const operation: MutationOperation<TodoListInput, TodoList> = {
        id: 'lists.create',
        name: 'Create List',
        isDestructive: false,
        requiresConfirmation: false,
        validator: (input) => {
          const errors: Array<{ field: string; message: string }> = [];
          if (!input.title || input.title.trim().length === 0) {
            errors.push({ field: 'title', message: 'Title is required' });
          }
          if (input.title && input.title.length > 255) {
            errors.push({ field: 'title', message: 'Title must be 255 characters or less' });
          }
          if (input.description && input.description.length > 1000) {
            errors.push({ field: 'description', message: 'Description must be 1000 characters or less' });
          }
          return errors;
        },
        executor: (input) => repository.createList(input),
        onSuccess: (list) => {
          // Invalidate lists query to refetch
          queryClient.invalidateQueries({ queryKey: ['lists'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        },
      };

      const result = await orchestrator.executeMutation(operation, input);
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to create list');
      }
      return result.data!;
    },
  });

  /**
   * Update an existing list
   */
  const updateListMutation = useMutation({
    mutationFn: async ({
      listId,
      input,
    }: {
      listId: string;
      input: TodoListUpdateInput;
    }) => {
      const currentList = queryClient.getQueryData(listQueryOptions(repository, listId).queryKey);

      const operation: MutationOperation<TodoListUpdateInput, TodoList, TodoList | undefined> = {
        id: 'lists.update',
        name: 'Update List',
        isDestructive: false,
        requiresConfirmation: false,
        validator: (input) => {
          const errors: Array<{ field: string; message: string }> = [];
          if (input.title !== undefined && input.title.length > 255) {
            errors.push({ field: 'title', message: 'Title must be 255 characters or less' });
          }
          if (input.description !== undefined && input.description.length > 1000) {
            errors.push({ field: 'description', message: 'Description must be 1000 characters or less' });
          }
          return errors;
        },
        executor: (input) => repository.updateList(listId, input),
        optimisticUpdater: (input, cache) => {
          if (!cache) return cache;
          return {
            ...cache,
            title: input.title ?? cache.title,
            description: input.description ?? cache.description,
            status: input.status ?? cache.status,
            updatedAt: new Date().toISOString(),
          };
        },
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['lists'] });
          queryClient.invalidateQueries({ queryKey: listQueryOptions(repository, listId).queryKey });
        },
      };

      const result = await orchestrator.executeMutation(operation, input);
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to update list');
      }
      return result.data!;
    },
  });

  /**
   * Archive a list
   */
  const archiveListMutation = useMutation({
    mutationFn: async (listId: string) => {
      const operation: MutationOperation<string, TodoList> = {
        id: 'lists.archive',
        name: 'Archive List',
        isDestructive: true,
        requiresConfirmation: true,
        executor: () => repository.archiveList(listId),
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['lists'] });
          queryClient.invalidateQueries({ queryKey: listQueryOptions(repository, listId).queryKey });
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        },
      };

      const result = await orchestrator.executeMutation(operation, listId);
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to archive list');
      }
      return result.data!;
    },
  });

  /**
   * Delete a list (soft delete)
   */
  const deleteListMutation = useMutation({
    mutationFn: async (listId: string) => {
      const operation: MutationOperation<string, TodoList> = {
        id: 'lists.delete',
        name: 'Delete List',
        isDestructive: true,
        requiresConfirmation: true,
        executor: () => repository.deleteList(listId),
        getRecoveryPaths: (error, retryFn) => [
          {
            label: 'Undo deletion',
            action: async () => {
              await repository.restoreList(listId);
              queryClient.invalidateQueries({ queryKey: ['lists'] });
            },
            description: 'Restore this list and its tasks',
          },
        ],
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['lists'] });
          queryClient.invalidateQueries({ queryKey: listQueryOptions(repository, listId).queryKey });
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        },
      };

      const result = await orchestrator.executeMutation(operation, listId);
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to delete list');
      }
      return result.data!;
    },
  });

  /**
   * Restore a deleted list
   */
  const restoreListMutation = useMutation({
    mutationFn: async (listId: string) => {
      const operation: MutationOperation<string, TodoList> = {
        id: 'lists.restore',
        name: 'Restore List',
        isDestructive: false,
        requiresConfirmation: false,
        executor: () => repository.restoreList(listId),
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['lists'] });
          queryClient.invalidateQueries({ queryKey: listQueryOptions(repository, listId).queryKey });
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        },
      };

      const result = await orchestrator.executeMutation(operation, listId);
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to restore list');
      }
      return result.data!;
    },
  });

  return {
    createList: createListMutation,
    updateList: updateListMutation,
    archiveList: archiveListMutation,
    deleteList: deleteListMutation,
    restoreList: restoreListMutation,
  };
}
