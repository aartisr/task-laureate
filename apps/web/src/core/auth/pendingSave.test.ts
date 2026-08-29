import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/persistence.config', () => ({ authProvider: { getSession: vi.fn() } }));

import { authProvider } from '../../config/persistence.config';
import { clearPendingSaveIntent, getPendingSaveIntent, pendingSaveSummary, requireSignInForSave, savePendingSaveIntent } from './pendingSave';

describe('pending save authentication handoff', () => {
  afterEach(() => {
    clearPendingSaveIntent();
    vi.clearAllMocks();
  });

  it('keeps a list draft out of the URL and restores its safe destination', () => {
    savePendingSaveIntent({ kind: 'list', input: { title: 'Launch', description: 'Plan it' }, returnTo: '//untrusted.example' });
    expect(getPendingSaveIntent()).toEqual({ kind: 'list', input: { title: 'Launch', description: 'Plan it' }, returnTo: '/' });
    expect(pendingSaveSummary(getPendingSaveIntent())).toContain('Launch');
  });

  it('redirects an unauthenticated save through sign-in while retaining the task draft', async () => {
    vi.mocked(authProvider.getSession).mockResolvedValue(null);
    const redirect = vi.fn();
    await expect(requireSignInForSave({ kind: 'task', input: { listId: 'list-1', title: 'Review', priority: 'high', dueDate: null }, returnTo: '/lists/list-1' }, redirect)).resolves.toBe(false);
    expect(getPendingSaveIntent()?.input.title).toBe('Review');
    expect(redirect).toHaveBeenCalledWith('/sign-in?returnTo=%2Flists%2Flist-1');
  });

  it('allows an authenticated save without creating a pending draft', async () => {
    vi.mocked(authProvider.getSession).mockResolvedValue({ user: { id: 'user-1' }, accessToken: 'token' });
    await expect(requireSignInForSave({ kind: 'list', input: { title: 'Private' }, returnTo: '/' })).resolves.toBe(true);
    expect(getPendingSaveIntent()).toBeNull();
  });
});
