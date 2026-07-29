import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import {
  createMutationOrchestrator,
  type MutationOperation,
  type MutationError,
  type ValidationError,
} from './mutationOrchestrator';

describe('MutationOrchestrator', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  describe('Basic Execution', () => {
    it('should execute a valid mutation successfully', async () => {
      const orchestrator = createMutationOrchestrator({
        queryClient,
        userId: 'test-user',
        requestId: 'req-1',
        timestamp: Date.now(),
      });

      const operation: MutationOperation<{ value: string }, string> = {
        id: 'test.create',
        name: 'Create Test',
        isDestructive: false,
        requiresConfirmation: false,
        executor: async (input) => `Created: ${input.value}`,
      };

      const result = await orchestrator.executeMutation(operation, { value: 'hello' });

      expect(result.success).toBe(true);
      expect(result.data).toBe('Created: hello');
      expect(result.error).toBeUndefined();
    });

    it('should handle executor errors gracefully', async () => {
      const orchestrator = createMutationOrchestrator({
        queryClient,
        userId: 'test-user',
        requestId: 'req-1',
        timestamp: Date.now(),
      });

      const operation: MutationOperation<{ value: string }, string> = {
        id: 'test.error',
        name: 'Error Test',
        isDestructive: false,
        requiresConfirmation: false,
        executor: async () => {
          throw new Error('Execution failed');
        },
      };

      const result = await orchestrator.executeMutation(operation, { value: 'test' });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Execution failed');
      expect(result.error?.recoveryPaths.length).toBeGreaterThan(0);
    });
  });

  describe('Validation', () => {
    it('should validate input before execution', async () => {
      const orchestrator = createMutationOrchestrator({
        queryClient,
        userId: 'test-user',
        requestId: 'req-1',
        timestamp: Date.now(),
      });

      const validator = (input: { title: string; description?: string }): ValidationError[] => {
        const errors: ValidationError[] = [];
        if (!input.title || input.title.trim().length === 0) {
          errors.push({ field: 'title', message: 'Title is required' });
        }
        if (input.title && input.title.length > 255) {
          errors.push({ field: 'title', message: 'Title must be 255 characters or less' });
        }
        return errors;
      };

      const operation: MutationOperation<{ title: string; description?: string }, string> = {
        id: 'test.validate',
        name: 'Validate Test',
        isDestructive: false,
        requiresConfirmation: false,
        validator,
        executor: async (input) => `Created: ${input.title}`,
      };

      // Test empty title
      const result1 = await orchestrator.executeMutation(operation, { title: '' });
      expect(result1.success).toBe(false);
      expect(result1.error?.code).toBe('VALIDATION_ERROR');

      // Test title too long
      const result2 = await orchestrator.executeMutation(operation, {
        title: 'a'.repeat(256),
      });
      expect(result2.success).toBe(false);
      expect(result2.error?.code).toBe('VALIDATION_ERROR');

      // Test valid input
      const result3 = await orchestrator.executeMutation(operation, { title: 'Valid Title' });
      expect(result3.success).toBe(true);
    });
  });

  describe('Optimistic Updates', () => {
    it('should apply optimistic updates', async () => {
      const orchestrator = createMutationOrchestrator({
        queryClient,
        userId: 'test-user',
        requestId: 'req-1',
        timestamp: Date.now(),
      });

      interface CacheData {
        items: string[];
      }

      const operation: MutationOperation<{ item: string }, string, CacheData> = {
        id: 'test.optimistic',
        name: 'Optimistic Test',
        isDestructive: false,
        requiresConfirmation: false,
        executor: async (input) => {
          // Simulate network delay
          await new Promise((resolve) => setTimeout(resolve, 10));
          return `Added: ${input.item}`;
        },
        optimisticUpdater: (input, cache) => {
          return {
            ...cache,
            items: [...(cache.items || []), input.item],
          };
        },
      };

      const result = await orchestrator.executeMutation(operation, { item: 'new-item' });

      expect(result.success).toBe(true);
      expect(result.snapshot).toBeDefined();
    });
  });

  describe('Lifecycle Hooks', () => {
    it('should call onSuccess hook', async () => {
      const onSuccessSpy = vi.fn();
      const orchestrator = createMutationOrchestrator({
        queryClient,
        userId: 'test-user',
        requestId: 'req-1',
        timestamp: Date.now(),
      });

      const operation: MutationOperation<{ value: string }, string> = {
        id: 'test.success',
        name: 'Success Hook Test',
        isDestructive: false,
        requiresConfirmation: false,
        executor: async (input) => `Created: ${input.value}`,
        onSuccess: onSuccessSpy,
      };

      await orchestrator.executeMutation(operation, { value: 'test' });

      expect(onSuccessSpy).toHaveBeenCalledWith('Created: test');
    });

    it('should call onError hook on failure', async () => {
      const onErrorSpy = vi.fn();
      const orchestrator = createMutationOrchestrator({
        queryClient,
        userId: 'test-user',
        requestId: 'req-1',
        timestamp: Date.now(),
      });

      const operation: MutationOperation<{ value: string }, string> = {
        id: 'test.error-hook',
        name: 'Error Hook Test',
        isDestructive: false,
        requiresConfirmation: false,
        executor: async () => {
          throw new Error('Test error');
        },
        onError: onErrorSpy,
      };

      await orchestrator.executeMutation(operation, { value: 'test' });

      expect(onErrorSpy).toHaveBeenCalled();
      const error = onErrorSpy.mock.calls[0]?.[0] as MutationError;
      expect(error.message).toContain('Test error');
    });
  });

  describe('Recovery Paths', () => {
    it('should provide recovery paths on error', async () => {
      const orchestrator = createMutationOrchestrator({
        queryClient,
        userId: 'test-user',
        requestId: 'req-1',
        timestamp: Date.now(),
      });

      const operation: MutationOperation<{ value: string }, string> = {
        id: 'test.recovery',
        name: 'Recovery Test',
        isDestructive: false,
        requiresConfirmation: false,
        executor: async () => {
          throw new Error('Network error');
        },
        getRecoveryPaths: (error, retryFn) => [
          {
            label: 'Retry immediately',
            action: retryFn,
            description: 'Try again right now',
          },
          {
            label: 'Retry in 5 seconds',
            action: async () => {
              await new Promise((resolve) => setTimeout(resolve, 5000));
              await retryFn();
            },
            description: 'Wait 5 seconds and retry',
          },
        ],
      };

      const result = await orchestrator.executeMutation(operation, { value: 'test' });

      expect(result.success).toBe(false);
      expect(result.error?.recoveryPaths.length).toBeGreaterThanOrEqual(3); // Default + custom
    });
  });

  describe('Retry Logic', () => {
    it('should retry failed mutations with exponential backoff', async () => {
      let attemptCount = 0;
      const orchestrator = createMutationOrchestrator({
        queryClient,
        userId: 'test-user',
        requestId: 'req-1',
        timestamp: Date.now(),
      });

      const operation: MutationOperation<{ value: string }, string> = {
        id: 'test.retry',
        name: 'Retry Test',
        isDestructive: false,
        requiresConfirmation: false,
        executor: async () => {
          attemptCount++;
          if (attemptCount < 2) {
            throw new Error('First attempt fails');
          }
          return 'Success on retry';
        },
      };

      const result = await orchestrator.executeMutation(operation, { value: 'test' });

      expect(result.success).toBe(true);
      expect(attemptCount).toBe(2);
    });

    it('should give up after max retries', async () => {
      const orchestrator = createMutationOrchestrator({
        queryClient,
        userId: 'test-user',
        requestId: 'req-1',
        timestamp: Date.now(),
      });

      const operation: MutationOperation<{ value: string }, string> = {
        id: 'test.max-retries',
        name: 'Max Retries Test',
        isDestructive: false,
        requiresConfirmation: false,
        executor: async () => {
          throw new Error('Always fails');
        },
      };

      const result = await orchestrator.executeMutation(operation, { value: 'test' });

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Always fails');
    });
  });

  describe('Measurement', () => {
    it('should measure mutation duration', async () => {
      const orchestrator = createMutationOrchestrator({
        queryClient,
        userId: 'test-user',
        requestId: 'req-1',
        timestamp: Date.now(),
      });

      const operation: MutationOperation<{ value: string }, string> = {
        id: 'test.duration',
        name: 'Duration Test',
        isDestructive: false,
        requiresConfirmation: false,
        executor: async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return 'Done';
        },
      };

      const result = await orchestrator.executeMutation(operation, { value: 'test' });

      expect(result.duration).toBeGreaterThanOrEqual(50);
      expect(result.success).toBe(true);
    });
  });
});
