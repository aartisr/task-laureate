import { act } from 'react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({ panel: vi.fn() }));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: ComponentPropsWithoutRef<'a'> & { to: string; children: ReactNode }) => <a href={to} {...props}>{children}</a>,
}));
vi.mock('../components/CloudSyncAuthPanel', () => ({
  CloudSyncAuthPanel: (props: unknown) => {
    mocked.panel(props);
    return <div data-testid="cloud-sync-panel" />;
  },
}));
vi.mock('../config/persistence.config', () => ({ authProvider: { configured: true } }));

import { SignInPage } from './SignInPage';

describe('SignInPage', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it('offers a clear return-home path without starting authentication', async () => {
    await act(async () => root.render(<SignInPage />));

    expect(host.querySelector('h1')?.textContent).toContain('Pick up your momentum');
    const cancel = Array.from(host.querySelectorAll<HTMLAnchorElement>('a')).find((link) => link.textContent === 'Cancel and return home');
    expect(cancel?.getAttribute('href')).toBe('/');
    expect(host.querySelector<HTMLImageElement>('.sign-in-page__home-link img')?.getAttribute('src')).toBe('/.well-known/logo-small.svg');
    expect(mocked.panel).toHaveBeenCalledWith(expect.objectContaining({ returnTo: '/', presentation: 'embedded', onAuthenticated: expect.any(Function) }));
  });
});
