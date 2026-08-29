import { beforeEach, describe, expect, it } from 'vitest';
import { MAX_FAVORITE_LISTS, pruneListFavorites, toggleListFavorite } from './listFavorites';

describe('list favorites', () => {
  beforeEach(() => localStorage.clear());

  it('keeps Favorites personal, bounded, and reversible', () => {
    expect(toggleListFavorite('list-a')).toEqual({ favorited: true, limitReached: false });
    expect(toggleListFavorite('list-a')).toEqual({ favorited: false, limitReached: false });
    for (let index = 0; index < MAX_FAVORITE_LISTS; index += 1) toggleListFavorite(`list-${index}`);
    expect(toggleListFavorite('one-too-many')).toEqual({ favorited: false, limitReached: true });
  });

  it('removes shortcuts that are no longer visible in the workspace', () => {
    toggleListFavorite('visible');
    toggleListFavorite('gone');
    pruneListFavorites(new Set(['visible']));
    expect(JSON.parse(localStorage.getItem('task-laureate.favorite-list-ids.v1') ?? '[]')).toEqual(['visible']);
  });
});
