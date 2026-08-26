import { useSyncExternalStore } from 'react';

/** Personal navigation shortcuts, deliberately independent from shared priority. */
export const MAX_FAVORITE_LISTS = 5;
const storageKey = 'task-laureate.favorite-list-ids.v1';
const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedIds: string[] = [];

function readIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (raw === cachedRaw) return cachedIds;
    const parsed: unknown = JSON.parse(raw ?? '[]');
    cachedRaw = raw;
    cachedIds = Array.isArray(parsed) ? [...new Set(parsed.filter((value): value is string => typeof value === 'string' && value.length > 0 && value.length <= 200))].slice(0, MAX_FAVORITE_LISTS) : [];
    return cachedIds;
  } catch { return []; }
}

function writeIds(ids: string[]) {
  if (typeof window !== 'undefined') {
    try { const raw = JSON.stringify(ids); window.localStorage.setItem(storageKey, raw); cachedRaw = raw; cachedIds = ids; } catch { /* Storage can be unavailable in private contexts. */ }
  }
  listeners.forEach((listener) => listener());
}

export function toggleListFavorite(listId: string): { favorited: boolean; limitReached: boolean } {
  const id = listId.trim();
  if (!id || id.length > 200) return { favorited: false, limitReached: false };
  const current = readIds();
  if (current.includes(id)) { writeIds(current.filter((item) => item !== id)); return { favorited: false, limitReached: false }; }
  if (current.length >= MAX_FAVORITE_LISTS) return { favorited: false, limitReached: true };
  writeIds([...current, id]);
  return { favorited: true, limitReached: false };
}

/** Removes IDs that are no longer visible to the current workspace member. */
export function pruneListFavorites(visibleIds: ReadonlySet<string>) {
  const current = readIds();
  const next = current.filter((id) => visibleIds.has(id));
  if (next.length !== current.length) writeIds(next);
}

export function subscribeToListFavorites(listener: () => void) {
  listeners.add(listener);
  if (typeof window === 'undefined') return () => listeners.delete(listener);
  const onStorage = (event: StorageEvent) => { if (event.key === storageKey) listener(); };
  window.addEventListener('storage', onStorage);
  return () => { listeners.delete(listener); window.removeEventListener('storage', onStorage); };
}

export function useFavoriteListIds() {
  return useSyncExternalStore(subscribeToListFavorites, readIds, () => []);
}
