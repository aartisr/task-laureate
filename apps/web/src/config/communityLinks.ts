const REPOSITORY_URL = 'https://github.com/aartisr/task-laureate';

function newIssueUrl(title: string, body: string) {
  const query = new URLSearchParams({ title, body });
  return `${REPOSITORY_URL}/issues/new?${query.toString()}`;
}

export type CommunityLink = {
  id: 'bug-report' | 'idea' | 'star' | 'fork';
  icon: string;
  title: string;
  description: string;
  href: string;
  className: string;
};

/**
 * The project's public contribution destinations. Keeping them here gives the
 * Support page one canonical, testable source of truth.
 */
export const COMMUNITY_LINKS: readonly CommunityLink[] = [
  {
    id: 'bug-report',
    icon: '🐛',
    title: 'Report a bug',
    description: 'Found something broken? Send a pre-filled GitHub issue with the details we need to investigate.',
    href: newIssueUrl('[Bug] ', '## What happened?\n\n## What did you expect?\n\n## Steps to reproduce\n1. \n\n## Device and browser\n'),
    className: 'community-card--github',
  },
  {
    id: 'idea',
    icon: '💡',
    title: 'Share an idea',
    description: 'Suggest an improvement or share how you use Task-Laureate in a pre-filled GitHub issue.',
    href: newIssueUrl('[Idea] ', '## What would make Task-Laureate better?\n\n## Why would it help?\n\n## Anything else to know?\n'),
    className: 'community-card--discuss',
  },
  {
    id: 'star',
    icon: '⭐',
    title: 'Star on GitHub',
    description: 'If Task-Laureate has helped you, a star helps other people discover the project.',
    href: REPOSITORY_URL,
    className: 'community-card--star',
  },
  {
    id: 'fork',
    icon: '🍴',
    title: 'Fork & build',
    description: 'Create your own copy of the codebase on GitHub and adapt it to your needs.',
    href: `${REPOSITORY_URL}/fork`,
    className: 'community-card--fork',
  },
] as const;

export { REPOSITORY_URL };
