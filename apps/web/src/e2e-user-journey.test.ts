import { describe, it, expect } from 'vitest';
import { parseCapture, recommendTasks } from './core/domain/antiBacklog';
import { createCaptureOutboxItem, createOutboxStore } from './infrastructure/antiBacklog/localFirstCapture';
import { createMemoryTodoRepository } from './infrastructure/mock/memoryRepository';
import { createEmptyWorkspace } from './infrastructure/persistence/workspace';
import { flushCaptureOutbox } from './core/services/captureDelivery';
import type { TodoItem } from './core/contracts/domain';

describe('End-to-End User Journey & Anti-Backlog Lifecycle', () => {
  const referenceDate = new Date('2026-08-29T10:00:00.000Z');

  it('completes the full Omnibar capture -> parsing -> outbox -> list placement journey', async () => {
    const repository = createMemoryTodoRepository(createEmptyWorkspace());
    const outbox = createOutboxStore();

    // 1. User has an existing Project List
    const existingList = await repository.createList({ title: 'Q3 Product Launch' });

    // 2. User types a rich natural language thought into Quick Capture
    const rawInput = 'Finalize enterprise pricing tiers /q3-product-launch ~deep !urgent 45m #strategy #pricing tomorrow';
    const parsed = parseCapture(rawInput, referenceDate);

    expect(parsed.title).toBe('Finalize enterprise pricing tiers');
    expect(parsed.targetListSlugOrName).toBe('q3-product-launch');
    expect(parsed.energyLevel).toBe('deep');
    expect(parsed.priority).toBe('high');
    expect(parsed.estimateMinutes).toBe(45);
    expect(parsed.tags).toEqual(['strategy', 'pricing']);
    expect(parsed.scheduledStartAt).toContain('2026-08-30');

    // 3. User enqueues capture to durable outbox targeting that list
    const outboxItem = createCaptureOutboxItem(rawInput, parsed, existingList.id);
    await outbox.enqueue(outboxItem);

    // 4. Outbox flushes to persistence repository
    const flushResult = await flushCaptureOutbox(outbox, repository);
    expect(flushResult.delivered).toBe(1);

    // 5. Verify task is cleanly persisted in the destination list with all parsed metadata
    const tasks = await repository.listTasks(existingList.id);
    const createdTask = tasks.find((t) => t.title === 'Finalize enterprise pricing tiers');
    expect(createdTask).toBeDefined();
    expect(createdTask?.tags).toEqual(['strategy', 'pricing']);
  });

  it('processes multi-line brain dumps into individual tasks atomically', async () => {
    const repository = createMemoryTodoRepository(createEmptyWorkspace());
    const outbox = createOutboxStore();

    const rawBrainDump = `Prepare slides for demo 30m ~deep !urgent
Schedule 1:1 sync with engineering #team 15m
Review pull requests #code 20m`;

    const parsed = parseCapture(rawBrainDump, referenceDate);
    expect(parsed.isMultiLine).toBe(true);
    expect(parsed.individualItems).toHaveLength(3);

    const outboxItem = createCaptureOutboxItem(rawBrainDump, parsed, null);
    await outbox.enqueue(outboxItem);
    const flushResult = await flushCaptureOutbox(outbox, repository);
    expect(flushResult.delivered).toBe(1);

    const lists = await repository.listLists();
    const inbox = lists.find((l) => l.title === 'Inbox');
    expect(inbox).toBeDefined();
    const tasks = await repository.listTasks(inbox!.id);
    expect(tasks.length).toBeGreaterThanOrEqual(3);
    const titles = tasks.map((t) => t.title);
    expect(titles).toContain('Prepare slides for demo');
    expect(titles).toContain('Schedule 1:1 sync with engineering');
    expect(titles).toContain('Review pull requests');
  });

  it('runs the cognitive capacity and focus recommendation engine accurately', () => {
    const makeTask = (id: string, title: string, order: number): TodoItem => ({
      id,
      listId: 'inbox',
      title,
      notes: '',
      status: 'todo',
      priority: 'medium',
      dueDate: null,
      tags: [],
      order,
      createdAt: referenceDate.toISOString(),
      updatedAt: referenceDate.toISOString(),
      completedAt: null,
      deletedAt: null,
    });

    const candidates = [
      makeTask('deep', 'Deep architecture review', 1),
      makeTask('quick', 'Quick inbox triage', 2),
      makeTask('light', 'Medium documentation update', 3),
    ];

    const metadata = {
      deep: { estimateMinutes: 60, energyLevel: 'deep' as const, scheduledStartAt: null, parentTaskId: null, needsClarity: false },
      quick: { estimateMinutes: 10, energyLevel: 'quick' as const, scheduledStartAt: null, parentTaskId: null, needsClarity: false },
      light: { estimateMinutes: 25, energyLevel: 'light' as const, scheduledStartAt: null, parentTaskId: null, needsClarity: false },
    };

    // Evaluate recommendation when user selects deep energy with 60 minutes
    const deepRecommendation = recommendTasks(candidates, metadata, {
      availableMinutes: 60,
      energyLevel: 'deep',
      now: referenceDate,
    });
    expect(deepRecommendation[0].task.id).toBe('deep');
    expect(deepRecommendation[0].reasons).toContain('Matches your selected energy.');
    expect(deepRecommendation[0].reasons).toContain('Fits your 60-minute window.');

    // Evaluate recommendation when user selects quick energy with 15 minutes
    const quickRecommendation = recommendTasks(candidates, metadata, {
      availableMinutes: 15,
      energyLevel: 'quick',
      now: referenceDate,
    });
    expect(quickRecommendation[0].task.id).toBe('quick');
    expect(quickRecommendation[0].reasons).toContain('Matches your selected energy.');
    expect(quickRecommendation[0].reasons).toContain('Fits your 15-minute window.');
  });
});
