import { StrictMode } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({
  completeOAuthCallback: vi.fn(),
  initializePersistence: vi.fn(),
}));

vi.mock('../config/persistence.config', () => ({
  authProvider: {
    configured: true,
    getSession: vi.fn(),
    signOut: vi.fn(),
    subscribe: vi.fn(() => () => undefined),
    completeOAuthCallback: mocked.completeOAuthCallback,
    signInWithOAuth: vi.fn(),
    getIdentities: vi.fn(),
    linkIdentity: vi.fn(),
    unlinkIdentity: vi.fn(),
  },
}));
vi.mock('../infrastructure/persistence/supabaseAuth', () => ({ consumeOAuthReturnTo: () => '/' }));
vi.mock('../app/runtime/appServices', () => ({ initializePersistence: mocked.initializePersistence }));

import { AuthCallbackPage } from './AuthCallbackPage';

describe('AuthCallbackPage', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    mocked.initializePersistence.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it('keeps an active completion handler during React Strict Mode effect replay', async () => {
    let complete!: (value: { user: { id: string }; accessToken: string }) => void;
    mocked.completeOAuthCallback.mockReturnValue(new Promise((resolve) => { complete = resolve; }));
    mocked.initializePersistence.mockRejectedValue(new Error('test persistence failure'));

    await act(async () => {
      root.render(<StrictMode><AuthCallbackPage /></StrictMode>);
    });
    expect(mocked.completeOAuthCallback).toHaveBeenCalledTimes(2);

    await act(async () => {
      complete({ user: { id: 'user-a' }, accessToken: 'token' });
      await Promise.resolve();
    });

    expect(mocked.initializePersistence).toHaveBeenCalledWith({ force: true });
    expect(host.textContent).toContain('Sign-in needs another try');
    expect(host.textContent).toContain('test persistence failure');
  });
});
