import type { CursorPage, CursorPageInput } from '../contracts/repository';

export const DEFAULT_PAGE_SIZE = 24;
export const MAX_PAGE_SIZE = 100;

type CursorRecord = { id: string };

/**
 * Small adapter used by memory today and by a DB adapter tomorrow. Cursors are
 * base64url encoded ids rather than numeric offsets, so additions/removals do
 * not make a later page skip an arbitrary number of records.
 */
export function createCursorPage<T extends CursorRecord>(
  records: readonly T[],
  input: CursorPageInput = {},
): CursorPage<T> {
  const limit = clampPageSize(input.limit);
  const cursorId = decodeCursor(input.cursor);
  const start = cursorId ? Math.max(0, records.findIndex((record) => record.id === cursorId) + 1) : 0;
  const items = records.slice(start, start + limit);
  const last = items.at(-1);
  return {
    items,
    nextCursor: last && start + items.length < records.length ? encodeCursor(last.id) : null,
    total: records.length,
  };
}

export function clampPageSize(value?: number) {
  if (!Number.isFinite(value)) return DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(value!)));
}

function encodeCursor(id: string) {
  return btoa(encodeURIComponent(id)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function decodeCursor(cursor?: string | null) {
  if (!cursor || !/^[A-Za-z0-9_-]+$/.test(cursor)) return null;
  try {
    const padded = cursor.replaceAll('-', '+').replaceAll('_', '/') + '==='.slice((cursor.length + 3) % 4);
    return decodeURIComponent(atob(padded));
  } catch {
    return null;
  }
}
