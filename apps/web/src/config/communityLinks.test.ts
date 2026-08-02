import { describe, expect, it } from 'vitest';
import { COMMUNITY_LINKS, REPOSITORY_URL } from './communityLinks';

describe('community link registry', () => {
  it('contains one canonical, secure GitHub destination for every contribution action', () => {
    expect(COMMUNITY_LINKS.map((link) => link.id)).toEqual(['bug-report', 'idea', 'star', 'fork']);

    for (const link of COMMUNITY_LINKS) {
      const url = new URL(link.href);
      expect(url.protocol).toBe('https:');
      expect(url.hostname).toBe('github.com');
      expect(url.pathname.startsWith('/aartisr/task-laureate')).toBe(true);
      expect(link.title).not.toHaveLength(0);
      expect(link.description).not.toHaveLength(0);
    }
  });

  it('provides useful pre-filled issue forms for bug reports and ideas', () => {
    for (const id of ['bug-report', 'idea'] as const) {
      const link = COMMUNITY_LINKS.find((candidate) => candidate.id === id);
      const url = new URL(link?.href ?? '');

      expect(url.pathname).toBe('/aartisr/task-laureate/issues/new');
      expect(url.searchParams.get('title')).toMatch(/^\[(Bug|Idea)\] /);
      expect(url.searchParams.get('body')).toContain('##');
    }
  });

  it('uses the repository and GitHub fork flow for the remaining actions', () => {
    expect(COMMUNITY_LINKS.find((link) => link.id === 'star')?.href).toBe(REPOSITORY_URL);
    expect(COMMUNITY_LINKS.find((link) => link.id === 'fork')?.href).toBe(`${REPOSITORY_URL}/fork`);
  });
});
