import { describe, it, expect, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { createMemoryTodoRepository } from '../../infrastructure/mock/memoryRepository';
import { createMutationOrchestrator } from './mutationOrchestrator';
import { createUndoStack, type Command } from './undoStack';
import type { TodoList, TodoItem } from '../contracts/domain';

interface AppState {
  lists: Map<string, TodoList>;
  tasks: Map<string, TodoItem>;
}

describe('Integration: Full Workflow', () => {
  let repository: ReturnType<typeof createMemoryTodoRepository>;
  let queryClient: QueryClient;
  let orchestrator: ReturnType<typeof createMutationOrchestrator>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    repository = createMemoryTodoRepository({
      lists: [],
      tasks: [],
      activity: [],
      templates: [],
    });

    orchestrator = createMutationOrchestrator({
      queryClient,
      userId: 'test-user',
      requestId: 'req-1',
      timestamp: Date.now(),
    });

  });

  describe('Complete Task Workflow', () => {
    it('should handle create -> update -> complete -> undo workflow', async () => {
      // Step 1: Create a list
      const list = await repository.createList({
        title: 'Weekly Tasks',
        description: 'Tasks for this week',
      });

      expect(list).toBeDefined();
      expect(list.taskCount).toBe(0);

      // Step 2: Create tasks
      const task1 = await repository.createTask({
        listId: list.id,
        title: 'Learn Vitest',
        priority: 'high',
      });

      const task2 = await repository.createTask({
        listId: list.id,
        title: 'Write tests',
        priority: 'medium',
      });

      let listAfterCreation = await repository.getList(list.id);
      expect(listAfterCreation?.taskCount).toBe(2);

      // Step 3: Update a task
      const updated = await repository.updateTask(task1.id, {
        title: 'Master Vitest',
        priority: 'urgent',
      });

      expect(updated.title).toBe('Master Vitest');
      expect(updated.priority).toBe('urgent');

      // Step 4: Complete first task
      const completed = await repository.completeTask(task1.id, true);
      expect(completed.status).toBe('done');
      expect(completed.completedAt).toBeTruthy();

      // Step 5: Verify list stats
      listAfterCreation = await repository.getList(list.id);
      expect(listAfterCreation?.completedTaskCount).toBe(1);
      expect(listAfterCreation?.completionPercent).toBeGreaterThan(0);

      // Step 6: Delete second task
      const deleted = await repository.deleteTask(task2.id);
      expect(deleted.status).toBe('deleted');

      listAfterCreation = await repository.getList(list.id);
      expect(listAfterCreation?.taskCount).toBe(1); // Deleted task not counted

      // Step 7: Restore task
      const restored = await repository.restoreTask(task2.id);
      expect(restored.status).toBe('todo');

      listAfterCreation = await repository.getList(list.id);
      expect(listAfterCreation?.taskCount).toBe(2);
    });

    it('should maintain consistency across operations', async () => {
      const list = await repository.createList({ title: 'Consistency Test' });

      // Create 5 tasks
      const tasks: TodoItem[] = [];
      for (let i = 0; i < 5; i++) {
        const task = await repository.createTask({
          listId: list.id,
          title: `Task ${i + 1}`,
        });
        tasks.push(task);
      }

      let currentList = await repository.getList(list.id);
      expect(currentList?.taskCount).toBe(5);
      expect(currentList?.completedTaskCount).toBe(0);

      // Complete 3 tasks
      for (let i = 0; i < 3; i++) {
        await repository.completeTask(tasks[i].id, true);
      }

      currentList = await repository.getList(list.id);
      expect(currentList?.completedTaskCount).toBe(3);
      expect(currentList?.completionPercent).toBe(60);

      // Delete 2 tasks
      await repository.deleteTask(tasks[3].id);
      await repository.deleteTask(tasks[4].id);

      currentList = await repository.getList(list.id);
      expect(currentList?.taskCount).toBe(3);
      expect(currentList?.completedTaskCount).toBe(3);
      expect(currentList?.completionPercent).toBe(100);
    });
  });

  describe('Search and Discovery', () => {
    it('should enable full-text search across lists and tasks', async () => {
      // Create test data
      const list1 = await repository.createList({
        title: 'Project Alpha',
        description: 'Design system components',
      });

      const list2 = await repository.createList({
        title: 'Project Beta',
        description: 'API development',
      });

      await repository.createTask({
        listId: list1.id,
        title: 'Design buttons',
        notes: 'Create reusable button component',
      });

      await repository.createTask({
        listId: list2.id,
        title: 'Design API schema',
        notes: 'Plan database and endpoints',
      });

      // Search for "design"
      const results = await repository.search({ query: 'design' });

      expect(results.results.length).toBeGreaterThanOrEqual(3);
      expect(results.results.some((r) => r.kind === 'list')).toBe(true);
      expect(results.results.some((r) => r.kind === 'task')).toBe(true);
    });

    it('should provide activity history for all operations', async () => {
      const list = await repository.createList({ title: 'Activity Test' });
      await repository.createTask({ listId: list.id, title: 'Task 1' });
      await repository.updateList(list.id, { title: 'Updated Title' });

      const activity = await repository.listActivity();

      expect(activity.length).toBeGreaterThanOrEqual(3);
      expect(activity.some((a) => a.action === 'created')).toBe(true);
      expect(activity.some((a) => a.action === 'updated')).toBe(true);
    });
  });

  describe('Error Scenarios and Recovery', () => {
    it('should handle concurrent mutations with conflict resolution', async () => {
      const list = await repository.createList({ title: 'Conflict Test' });

      // Simulate two concurrent updates
      const update1Promise = repository.updateList(list.id, { title: 'Update 1' });
      const update2Promise = repository.updateList(list.id, { title: 'Update 2' });

      await Promise.all([update1Promise, update2Promise]);

      // Last write wins (second update)
      const final = await repository.getList(list.id);
      expect(final?.title).toBe('Update 2');
    });

    it('should gracefully handle invalid operations', async () => {
      // Try to update non-existent list
      await expect(async () => {
        await repository.updateList('non-existent', { title: 'New Title' });
      }).rejects.toThrow();

      // Tasks must always belong to a visible list; orphan data would corrupt workspace totals.
      const listId = 'non-existent-list';
      await expect(repository.createTask({
        listId,
        title: 'Orphan Task',
      })).rejects.toThrow(`List not found: ${listId}`);
    });

    it('should support rollback after failed operations', async () => {
      const list = await repository.createList({ title: 'Rollback Test' });
      const originalTitle = list.title;

      // Create a mutation that would fail
      const failingMutation = {
        id: 'test.fail',
        name: 'Failing Mutation',
        isDestructive: false,
        requiresConfirmation: false,
        executor: async () => {
          throw new Error('Simulated failure');
        },
      };

      const result = await orchestrator.executeMutation(failingMutation, {});

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      // Original state should be retrievable
      const stillExists = await repository.getList(list.id);
      expect(stillExists?.title).toBe(originalTitle);
    });
  });

  describe('Undo/Redo Integration', () => {
    it('should support undo through undo stack', () => {
      const initialState: AppState = {
        lists: new Map(),
        tasks: new Map(),
      };

      const stack = createUndoStack(initialState);

      const cmd1: Command<AppState> = {
        id: 'add-list-1',
        timestamp: Date.now(),
        description: 'Add list 1',
        execute: (state) => {
          const newMap = new Map(state.lists);
          newMap.set('list-1', {
            id: 'list-1',
            title: 'List 1',
            description: '',
            status: 'active',
            templateId: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            archivedAt: null,
            deletedAt: null,
            completionPercent: 0,
            taskCount: 0,
            completedTaskCount: 0,
          });
          return { ...state, lists: newMap };
        },
        undo: (state) => {
          const newMap = new Map(state.lists);
          newMap.delete('list-1');
          return { ...state, lists: newMap };
        },
      };

      expect(stack.canUndo()).toBe(false);
      stack.execute(cmd1);
      expect(stack.canUndo()).toBe(true);

      stack.undo();
      expect(stack.canUndo()).toBe(false);
      expect(stack.canRedo()).toBe(true);

      stack.redo();
      expect(stack.canUndo()).toBe(true);
    });
  });

  describe('Dashboard Analytics', () => {
    it('should compute accurate dashboard metrics', async () => {
      // Create multiple lists and tasks
      const list1 = await repository.createList({ title: 'List 1' });
      const list2 = await repository.createList({ title: 'List 2' });

      const task1 = await repository.createTask({ listId: list1.id, title: 'Task 1' });
      await repository.createTask({ listId: list1.id, title: 'Task 2' });
      const task3 = await repository.createTask({ listId: list2.id, title: 'Task 3' });

      // Complete some tasks
      await repository.completeTask(task1.id, true);
      await repository.completeTask(task3.id, true);

      // Archive one list
      await repository.archiveList(list2.id);

      const dashboard = await repository.getDashboard();

      // Only active (non-deleted) lists should be in dashboard
      expect(dashboard.lists.length).toBe(1);
      expect(dashboard.summary.listCount).toBe(1); // Only active lists in summary
      expect(dashboard.summary.taskCount).toBe(2);
      expect(dashboard.summary.completedCount).toBe(1);
      expect(dashboard.summary.activeCount).toBe(1);
    });
  });

  describe('Performance Under Load', () => {
    it('should handle 100+ items efficiently', async () => {
      const list = await repository.createList({ title: 'Large List' });

      const startTime = Date.now();

      // Create 100 tasks
      for (let i = 0; i < 100; i++) {
        await repository.createTask({
          listId: list.id,
          title: `Task ${i + 1}`,
          priority: i % 2 === 0 ? 'high' : 'low',
        });
      }

      const duration = Date.now() - startTime;

      const tasks = await repository.listTasks(list.id);
      expect(tasks).toHaveLength(100);
      expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
    });

    it('should maintain consistent query performance', async () => {
      const list = await repository.createList({ title: 'Query Performance Test' });

      // Create tasks
      for (let i = 0; i < 50; i++) {
        await repository.createTask({
          listId: list.id,
          title: `Query Test Task ${i}`,
        });
      }

      const queryStart = Date.now();
      const tasks = await repository.listTasks(list.id);
      const queryDuration = Date.now() - queryStart;

      expect(tasks).toHaveLength(50);
      expect(queryDuration).toBeLessThan(100);
    });
  });
});
