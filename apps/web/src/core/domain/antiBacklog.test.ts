import { describe, expect, it } from 'vitest';
import { createTemplateProposal, needsClarity, parseCapture, recommendTasks } from './antiBacklog';
import type { TodoItem } from '../contracts/domain';

const task = (overrides: Partial<TodoItem> = {}): TodoItem => ({
  id: 'task-1', listId: 'list-1', title: 'Write brief', notes: '', status: 'todo', priority: 'medium', dueDate: null, tags: [], order: 1,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', completedAt: null, deletedAt: null, ...overrides,
});

describe('anti-backlog domain policy', () => {
  it('parses common capture metadata without losing the original input', () => {
    const parsed = parseCapture('Send report tomorrow #Work 15m', new Date('2026-02-01T12:00:00.000Z'));
    expect(parsed).toMatchObject({ title: 'Send report', tags: ['work'], estimateMinutes: 15, confidence: 'high', rawInput: 'Send report tomorrow #Work 15m' });
    expect(parsed.scheduledStartAt).toContain('2026-02-02');
  });

  it('makes the recommendation policy explainable and deterministic', () => {
    const candidates = [task({ id: 'deep' }), task({ id: 'other', order: 2 })];
    const result = recommendTasks(candidates, {
      deep: { estimateMinutes: 25, energyLevel: 'deep', scheduledStartAt: null, parentTaskId: null, needsClarity: false },
      other: { estimateMinutes: 45, energyLevel: 'light', scheduledStartAt: null, parentTaskId: null, needsClarity: false },
    }, { availableMinutes: 30, energyLevel: 'deep', now: new Date('2026-02-01') });
    expect(result[0].task.id).toBe('deep');
    expect(result[0].reasons).toContain('Matches your selected energy.');
  });

  it('keeps a no-AI decomposition fallback available', () => {
    const proposal = createTemplateProposal('Write research paper');
    expect(proposal.source).toBe('template');
    expect(proposal.steps).toHaveLength(4);
    expect(needsClarity({ estimateMinutes: null, energyLevel: 'deep' })).toBe(true);
  });
});
