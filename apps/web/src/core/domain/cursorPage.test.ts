import { describe, expect, it } from 'vitest';
import { createCursorPage, MAX_PAGE_SIZE } from './cursorPage';

const records = Array.from({ length: 4 }, (_, index) => ({ id: `id-${index + 1}` }));

describe('createCursorPage', () => {
  it('returns opaque cursor pages without duplicate boundary records', () => {
    const first = createCursorPage(records, { limit: 2 });
    const second = createCursorPage(records, { limit: 2, cursor: first.nextCursor });
    expect(first.items.map((item) => item.id)).toEqual(['id-1', 'id-2']);
    expect(second.items.map((item) => item.id)).toEqual(['id-3', 'id-4']);
    expect(second.nextCursor).toBeNull();
  });

  it('clamps oversized limits and treats malformed cursors as a fresh page', () => {
    expect(createCursorPage(records, { limit: MAX_PAGE_SIZE + 1 }).items).toHaveLength(4);
    expect(createCursorPage(records, { cursor: 'not a cursor' }).items[0].id).toBe('id-1');
  });
});
