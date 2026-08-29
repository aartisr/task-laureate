import { describe, expect, it } from 'vitest';
import { sortListsForAttention } from './listOrdering';

describe('sortListsForAttention', () => {
  it('always puts actionable lists ahead of completed history', () => {
    const lists = sortListsForAttention([
      { id: 'done', status: 'completed', updatedAt: '2026-08-25T10:00:00.000Z' },
      { id: 'active', status: 'active', updatedAt: '2026-08-01T10:00:00.000Z' },
      { id: 'archive', status: 'archived', updatedAt: '2026-08-26T10:00:00.000Z' },
    ]);

    expect(lists.map((list) => list.id)).toEqual(['active', 'done', 'archive']);
  });
});
