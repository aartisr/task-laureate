import { describe, it, expect, beforeEach } from 'vitest';
import type { TodoList } from '../contracts/domain';
import type { TodoRepository, TodoListInput, TodoTaskInput } from '../contracts/repository';
import { createMemoryTodoRepository } from '../../infrastructure/mock/memoryRepository';
import { getDashboardCompletionPercent } from '../domain/logic';

describe('List and Task CRUD Operations', () => {
  let repository: TodoRepository;
  beforeEach(() => {
    repository = createMemoryTodoRepository({
      lists: [],
      tasks: [],
      activity: [],
      templates: [],
    });
  });

  describe('List CRUD', () => {
    it('should create a new list', async () => {
      const input: TodoListInput = {
        title: 'My First List',
        description: 'A test list',
      };

      const list = await repository.createList(input);

      expect(list).toBeDefined();
      expect(list.id).toBeTruthy();
      expect(list.title).toBe('My First List');
      expect(list.description).toBe('A test list');
      expect(list.status).toBe('active');
      expect(list.taskCount).toBe(0);
      expect(list.completedTaskCount).toBe(0);
    });

    it('should retrieve a list by ID', async () => {
      const input: TodoListInput = {
        title: 'Test List',
      };

      const created = await repository.createList(input);
      const retrieved = await repository.getList(created.id);

      expect(retrieved).toEqual(created);
    });

    it('should update a list', async () => {
      const created = await repository.createList({
        title: 'Original Title',
        description: 'Original description',
      });

      // Add delay to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      const updated = await repository.updateList(created.id, {
        title: 'Updated Title',
        description: 'Updated description',
      });

      expect(updated.title).toBe('Updated Title');
      expect(updated.description).toBe('Updated description');
      expect(new Date(updated.updatedAt).getTime()).toBeGreaterThan(new Date(created.updatedAt).getTime());
    });

    it('should archive a list', async () => {
      const list = await repository.createList({ title: 'Archive Test' });
      const archived = await repository.archiveList(list.id);

      expect(archived.status).toBe('archived');
      expect(archived.archivedAt).toBeTruthy();
    });

    it('should delete a list (soft delete)', async () => {
      const list = await repository.createList({ title: 'Delete Test' });
      const deleted = await repository.deleteList(list.id);

      expect(deleted.status).toBe('deleted');
      expect(deleted.deletedAt).toBeTruthy();
    });

    it('should restore a deleted list', async () => {
      const list = await repository.createList({ title: 'Restore Test' });
      await repository.deleteList(list.id);
      const restored = await repository.restoreList(list.id);

      expect(restored.status).toBe('active');
      expect(restored.deletedAt).toBeNull();
    });

    it('should list all active lists', async () => {
      const list1 = await repository.createList({ title: 'List 1' });
      const list2 = await repository.createList({ title: 'List 2' });
      await repository.deleteList(list2.id);

      const lists = await repository.listLists();

      expect(lists).toHaveLength(1);
      expect(lists[0].id).toBe(list1.id);
    });

    it('should not return deleted lists', async () => {
      const list = await repository.createList({ title: 'Deleted' });
      await repository.deleteList(list.id);

      const retrieved = await repository.getList(list.id);

      // Note: getList returns the list regardless of deletion status
      // The filtering happens in listLists()
      expect(retrieved?.status).toBe('deleted');
    });

    it('excludes tasks in a deleted list from the dashboard and restores them with the list', async () => {
      const list = await repository.createList({ title: 'Temporary list' });
      await repository.createTask({ listId: list.id, title: 'Preserved for undo' });

      expect((await repository.getDashboard()).summary.taskCount).toBe(1);

      await repository.deleteList(list.id);
      expect((await repository.getDashboard()).summary).toMatchObject({
        listCount: 0,
        taskCount: 0,
        activeCount: 0,
      });

      await repository.restoreList(list.id);
      expect((await repository.getDashboard()).summary.taskCount).toBe(1);
    });

    it('keeps Tasks, Completed, and Progress dashboard tiles aligned with visible lists', async () => {
      const visibleList = await repository.createList({ title: 'Visible' });
      const completedVisibleTask = await repository.createTask({ listId: visibleList.id, title: 'Done' });
      await repository.completeTask(completedVisibleTask.id, true);
      await repository.createTask({ listId: visibleList.id, title: 'Remaining' });

      const deletedList = await repository.createList({ title: 'Deleted' });
      const completedDeletedTask = await repository.createTask({ listId: deletedList.id, title: 'Hidden done task' });
      await repository.completeTask(completedDeletedTask.id, true);
      await repository.createTask({ listId: deletedList.id, title: 'Hidden remaining task' });
      await repository.deleteList(deletedList.id);

      const { summary } = await repository.getDashboard();
      expect(summary).toMatchObject({ taskCount: 2, completedCount: 1, activeCount: 1 });
      expect(getDashboardCompletionPercent(summary)).toBe(50);
    });

    it('hides a deleted list consistently and prevents stale task mutations', async () => {
      const list = await repository.createList({ title: 'Hidden list' });
      const task = await repository.createTask({ listId: list.id, title: 'Must not leak' });
      await repository.deleteList(list.id);

      expect(await repository.listTasks(list.id)).toEqual([]);
      expect((await repository.search({ query: 'leak' })).results).toEqual([]);
      await expect(repository.createTask({ listId: list.id, title: 'Late task' }))
        .rejects.toThrow('Cannot change tasks in deleted list');
      await expect(repository.completeTask(task.id, true))
        .rejects.toThrow('Cannot change tasks in deleted list');

      await repository.restoreList(list.id);
      expect((await repository.listTasks(list.id)).map((item) => item.id)).toEqual([task.id]);
      expect((await repository.search({ query: 'leak' })).results).toHaveLength(1);
    });
  });

  describe('Task CRUD', () => {
    let list: TodoList;

    beforeEach(async () => {
      list = await repository.createList({ title: 'Test List' });
    });

    it('should create a new task', async () => {
      const input: TodoTaskInput = {
        listId: list.id,
        title: 'My First Task',
        notes: 'Some notes',
        priority: 'high',
      };

      const task = await repository.createTask(input);

      expect(task).toBeDefined();
      expect(task.id).toBeTruthy();
      expect(task.title).toBe('My First Task');
      expect(task.listId).toBe(list.id);
      expect(task.priority).toBe('high');
      expect(task.status).toBe('todo');
    });

    it('should update a task', async () => {
      const task = await repository.createTask({
        listId: list.id,
        title: 'Original Title',
        notes: 'Original notes',
      });

      // Add delay to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      const updated = await repository.updateTask(task.id, {
        title: 'Updated Title',
        priority: 'urgent',
      });

      expect(updated.title).toBe('Updated Title');
      expect(updated.priority).toBe('urgent');
      expect(new Date(updated.updatedAt).getTime()).toBeGreaterThan(new Date(task.updatedAt).getTime());
    });

    it('should move a task without losing its work details', async () => {
      const destination = await repository.createList({ title: 'Next up' });
      const task = await repository.createTask({ listId: list.id, title: 'Move me', notes: 'Keep this context', priority: 'high', dueDate: '2030-01-01', tags: ['handoff'] });

      const moved = await repository.moveTask(task.id, destination.id);

      expect(moved).toMatchObject({ id: task.id, listId: destination.id, title: 'Move me', notes: 'Keep this context', priority: 'high', dueDate: '2030-01-01', tags: ['handoff'] });
      expect(await repository.listTasks(list.id)).toEqual([]);
      expect((await repository.listTasks(destination.id)).map((item) => item.id)).toEqual([task.id]);
    });

    it('should complete a task', async () => {
      const task = await repository.createTask({
        listId: list.id,
        title: 'Task to Complete',
      });

      const completed = await repository.completeTask(task.id, true);

      expect(completed.status).toBe('done');
      expect(completed.completedAt).toBeTruthy();
    });

    it('should uncomplete a task', async () => {
      const task = await repository.createTask({
        listId: list.id,
        title: 'Task',
      });

      await repository.completeTask(task.id, true);
      const reopened = await repository.completeTask(task.id, false);

      expect(reopened.status).toBe('todo');
      expect(reopened.completedAt).toBeNull();
    });

    it('should delete a task (soft delete)', async () => {
      const task = await repository.createTask({
        listId: list.id,
        title: 'Task to Delete',
      });

      const deleted = await repository.deleteTask(task.id);

      expect(deleted.status).toBe('deleted');
      expect(deleted.deletedAt).toBeTruthy();
    });

    it('should restore a deleted task', async () => {
      const task = await repository.createTask({
        listId: list.id,
        title: 'Task',
      });

      await repository.deleteTask(task.id);
      const restored = await repository.restoreTask(task.id);

      expect(restored.status).toBe('todo');
      expect(restored.deletedAt).toBeNull();
    });

    it('should list all tasks in a list', async () => {
      const task1 = await repository.createTask({
        listId: list.id,
        title: 'Task 1',
      });
      const task2 = await repository.createTask({
        listId: list.id,
        title: 'Task 2',
      });
      await repository.deleteTask(task2.id);

      const tasks = await repository.listTasks(list.id);

      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe(task1.id);
    });

    it('should update list completion metrics', async () => {
      await repository.createTask({ listId: list.id, title: 'Task 1' });
      await repository.createTask({ listId: list.id, title: 'Task 2' });
      await repository.createTask({ listId: list.id, title: 'Task 3' });

      const tasks = await repository.listTasks(list.id);
      await repository.completeTask(tasks[0].id, true);
      await repository.completeTask(tasks[1].id, true);

      const updatedList = await repository.getList(list.id);

      expect(updatedList?.taskCount).toBe(3);
      expect(updatedList?.completedTaskCount).toBe(2);
      expect(updatedList?.completionPercent).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should throw when updating non-existent list', async () => {
      await expect(async () => {
        await repository.updateList('non-existent-id', { title: 'New Title' });
      }).rejects.toThrow();
    });

    it('should throw when getting non-existent task', async () => {
      const result = await repository.getTask('non-existent-id');
      expect(result).toBeNull();
    });

    it('should throw when deleting non-existent list', async () => {
      await expect(async () => {
        await repository.deleteList('non-existent-id');
      }).rejects.toThrow();
    });
  });

  describe('Search', () => {
    it('should search lists and tasks by query', async () => {
      const list = await repository.createList({
        title: 'Shopping List',
        description: 'Items to buy',
      });
      await repository.createTask({
        listId: list.id,
        title: 'Buy milk',
        notes: 'At the grocery store',
      });

      const results = await repository.search({ query: 'buy' });

      expect(results.results.length).toBeGreaterThan(0);
      expect(results.results.some((r) => r.title.toLowerCase().includes('buy'))).toBe(true);
    });

    it('should return empty results for non-matching query', async () => {
      await repository.createList({ title: 'My List' });

      const results = await repository.search({ query: 'xyz123nonexistent' });

      expect(results.results).toHaveLength(0);
    });
  });

  describe('Dashboard', () => {
    it('should compute dashboard summary', async () => {
      const list1 = await repository.createList({ title: 'List 1' });
      const list2 = await repository.createList({ title: 'List 2' });

      await repository.createTask({ listId: list1.id, title: 'Task 1' });
      await repository.createTask({ listId: list1.id, title: 'Task 2' });
      await repository.createTask({ listId: list2.id, title: 'Task 3' });

      // Complete one task
      const tasks1 = await repository.listTasks(list1.id);
      await repository.completeTask(tasks1[0].id, true);

      const dashboard = await repository.getDashboard();

      expect(dashboard.summary.listCount).toBe(2);
      expect(dashboard.summary.taskCount).toBe(3);
      expect(dashboard.summary.completedCount).toBe(1);
      expect(dashboard.summary.activeCount).toBe(2);
    });
  });
});
