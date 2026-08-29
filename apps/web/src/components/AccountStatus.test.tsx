import { act } from 'react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  getSession: vi.fn(),
  signOut: vi.fn(),
  subscribe: vi.fn(() => () => undefined),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: ComponentPropsWithoutRef<'a'> & { to: string; children: ReactNode }) => <a href={to} {...props}>{children}</a>,
}));
vi.mock('../infrastructure/persistence/status', () => ({
  getPersistenceStatus: () => ({ phase: 'synced', detail: 'Up to date', updatedAt: '2026-01-01T00:00:00.000Z' }),
  subscribeToPersistenceStatus: () => () => undefined,
}));

import { AccountStatus } from './AccountStatus';

describe('AccountStatus', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    mocked.subscribe.mockReturnValue(() => undefined);
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it('keeps sign-in as a direct link when no session exists', async () => {
    mocked.getSession.mockResolvedValue(null);

    await act(async () => {
      root.render(<AccountStatus provider={{ configured: true, ...mocked }} />);
      await Promise.resolve();
    });

    const signIn = host.querySelector<HTMLAnchorElement>('.account-status');
    expect(signIn?.getAttribute('href')).toBe('/sign-in');
    expect(host.textContent).toContain('Sign in to sync');
  });

  it('opens an accessible account menu and signs out from it', async () => {
    mocked.getSession.mockResolvedValue({
      user: { id: 'user-1', email: 'aarti@example.com', provider: 'google' },
      accessToken: 'session-token',
    });
    mocked.signOut.mockResolvedValue(undefined);

    await act(async () => {
      root.render(<AccountStatus provider={{ configured: true, ...mocked }} />);
      await Promise.resolve();
    });

    const trigger = host.querySelector<HTMLButtonElement>('.account-status');
    expect(trigger?.getAttribute('aria-expanded')).toBe('false');

    await act(async () => trigger?.click());
    expect(trigger?.getAttribute('aria-expanded')).toBe('true');
    expect(host.textContent).toContain('Signed in with google');
    expect(host.textContent).toContain('Account & sync settings');

    const signOut = Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Sign out');
    await act(async () => signOut?.click());

    expect(mocked.signOut).toHaveBeenCalledTimes(1);
    expect(host.querySelector('[role="menu"]')).toBeNull();
  });

  it('closes the account menu with Escape', async () => {
    mocked.getSession.mockResolvedValue({ user: { id: 'user-1', email: 'aarti@example.com' }, accessToken: 'session-token' });

    await act(async () => {
      root.render(<AccountStatus provider={{ configured: true, ...mocked }} />);
      await Promise.resolve();
    });
    await act(async () => host.querySelector<HTMLButtonElement>('.account-status')?.click());
    expect(host.querySelector('[role="menu"]')).not.toBeNull();

    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
    expect(host.querySelector('[role="menu"]')).toBeNull();
  });
});
