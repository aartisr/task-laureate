import { act } from 'react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COMMUNITY_LINKS } from '../config/communityLinks';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: ComponentPropsWithoutRef<'a'> & { to: string; children: ReactNode }) => <a href={to} {...props}>{children}</a>,
}));
vi.mock('../hooks/usePageSEO', () => ({
  PAGE_SEO: { support: {} },
  usePageSEO: vi.fn(),
}));

import { SupportPage } from './SupportPage';

describe('SupportPage contribution links', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it('renders each configured contribution destination safely and announces the new tab', async () => {
    await act(async () => root.render(<SupportPage />));

    const links = Array.from(host.querySelectorAll<HTMLAnchorElement>('.community-card'));
    expect(links).toHaveLength(COMMUNITY_LINKS.length);

    for (const configured of COMMUNITY_LINKS) {
      const link = links.find((candidate) => candidate.getAttribute('href') === configured.href);
      expect(link?.getAttribute('target')).toBe('_blank');
      expect(link?.getAttribute('rel')).toContain('noopener');
      expect(link?.getAttribute('rel')).toContain('noreferrer');
      expect(link?.getAttribute('aria-label')).toBe(`${configured.title} — opens GitHub in a new tab`);
      expect(link?.textContent).toContain(configured.title);
      expect(link?.textContent).toContain('Opens GitHub in a new tab.');
    }
  });
});
