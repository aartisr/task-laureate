import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  auth: {
    getSession: vi.fn(),
    exchangeCodeForSession: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChange: vi.fn(),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signInWithOAuth: vi.fn(),
    resend: vi.fn(),
    getUserIdentities: vi.fn(),
    linkIdentity: vi.fn(),
    unlinkIdentity: vi.fn(),
  },
  createClient: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({ createClient: mockState.createClient }));

const session = {
  access_token: 'access-token',
  refresh_token: 'refresh-token',
  user: { id: 'user-a', email: 'aarti@example.com', app_metadata: { provider: 'google' } },
};

async function loadAdapter() {
  vi.resetModules();
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'publishable-key');
  mockState.createClient.mockReturnValue({ auth: mockState.auth });
  return import('./supabaseAuth');
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.history.replaceState({}, '', '/sign-in');
  mockState.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
  mockState.auth.exchangeCodeForSession.mockResolvedValue({ data: { session }, error: null });
  mockState.auth.signOut.mockResolvedValue({ error: null });
  mockState.auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  mockState.auth.signInWithPassword.mockResolvedValue({ data: { session }, error: null });
  mockState.auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
  mockState.auth.signInWithOAuth.mockResolvedValue({ data: { url: 'https://auth.example.test' }, error: null });
  mockState.auth.resend.mockResolvedValue({ error: null });
  mockState.auth.getUserIdentities.mockResolvedValue({ data: { identities: [] }, error: null });
  mockState.auth.linkIdentity.mockResolvedValue({ error: null });
  mockState.auth.unlinkIdentity.mockResolvedValue({ error: null });
});

describe('supabaseAuthProvider', () => {
  it('exchanges the one-time PKCE callback code explicitly and maps the completed session', async () => {
    window.history.replaceState({}, '', '/auth/callback?code=one-time-code');
    const { supabaseAuthProvider } = await loadAdapter();

    await expect(supabaseAuthProvider.completeOAuthCallback()).resolves.toEqual({
      user: { id: 'user-a', email: 'aarti@example.com', provider: 'google' },
      accessToken: 'access-token',
    });
    expect(mockState.createClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'publishable-key',
      expect.objectContaining({ auth: expect.objectContaining({ detectSessionInUrl: false, flowType: 'pkce', lock: expect.any(Function) }) }),
    );
    expect(mockState.auth.exchangeCodeForSession).toHaveBeenCalledWith('one-time-code');
    expect(window.location.search).toBe('');
  });

  it('fails clearly when the callback produces no session', async () => {
    window.history.replaceState({}, '', '/auth/callback?code=one-time-code');
    mockState.auth.exchangeCodeForSession.mockResolvedValue({ data: { session: null }, error: null });
    const { supabaseAuthProvider } = await loadAdapter();
    await expect(supabaseAuthProvider.completeOAuthCallback()).rejects.toThrow('Sign-in was not completed');
  });

  it('rejects a direct or reused callback URL without attempting an exchange', async () => {
    const { supabaseAuthProvider } = await loadAdapter();

    await expect(supabaseAuthProvider.completeOAuthCallback()).rejects.toThrow('missing its one-time code');
    expect(mockState.auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('never leaves an OAuth callback pending forever when the auth runtime stalls', async () => {
    vi.useFakeTimers();
    window.history.replaceState({}, '', '/auth/callback?code=one-time-code');
    mockState.auth.exchangeCodeForSession.mockImplementation(() => new Promise(() => undefined));
    const { supabaseAuthProvider } = await loadAdapter();
    const completion = supabaseAuthProvider.completeOAuthCallback();
    const expectedFailure = expect(completion).rejects.toThrow('Sign-in took too long');

    await vi.advanceTimersByTimeAsync(20_000);
    await expectedFailure;
    vi.useRealTimers();
  });

  it('starts a provider-neutral OAuth redirect and retains only a safe local return path', async () => {
    const { consumeOAuthReturnTo, supabaseAuthProvider } = await loadAdapter();

    await supabaseAuthProvider.signInWithOAuth({ provider: 'google', returnTo: '/lists/123?view=all' });
    expect(mockState.auth.signInWithOAuth).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'google',
      options: expect.objectContaining({ redirectTo: expect.stringMatching(/\/auth\/callback$/) }),
    }));
    expect(consumeOAuthReturnTo()).toBe('/lists/123?view=all');

    await supabaseAuthProvider.signInWithOAuth({ provider: 'google', returnTo: 'https://attacker.invalid' });
    expect(consumeOAuthReturnTo()).toBe('/');
  });

  it('requests the email scope required by Supabase Azure authentication', async () => {
    const { supabaseAuthProvider } = await loadAdapter();
    await supabaseAuthProvider.signInWithOAuth({ provider: 'azure', returnTo: '/' });
    expect(mockState.auth.signInWithOAuth).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'azure',
      options: expect.objectContaining({ scopes: 'email', redirectTo: expect.stringMatching(/\/auth\/callback$/) }),
    }));
  });

  it('resends signup confirmation through the same safe callback URL', async () => {
    const { supabaseAuthProvider } = await loadAdapter();
    await supabaseAuthProvider.resendSignupConfirmation({ email: 'aarti@example.com' });
    expect(mockState.auth.resend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'aarti@example.com',
      options: { emailRedirectTo: expect.stringMatching(/\/auth\/callback$/) },
    });
  });

  it('maps password, device-local sign-out, and auth subscription behavior through the same session contract', async () => {
    const { supabaseAuthProvider } = await loadAdapter();
    const listener = vi.fn();

    await expect(supabaseAuthProvider.signIn({ email: 'aarti@example.com', password: 'correct horse battery staple' }))
      .resolves.toMatchObject({ user: { id: 'user-a', provider: 'google' } });
    await supabaseAuthProvider.signOut();
    supabaseAuthProvider.subscribe(listener);
    const callback = mockState.auth.onAuthStateChange.mock.calls[0][0] as (_event: string, value: typeof session | null) => void;
    callback('SIGNED_IN', session);
    callback('SIGNED_OUT', null);

    expect(mockState.auth.signOut).toHaveBeenCalledOnce();
    expect(mockState.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(listener).toHaveBeenNthCalledWith(1, expect.objectContaining({ user: expect.objectContaining({ id: 'user-a' }) }));
    expect(listener).toHaveBeenNthCalledWith(2, null);
  });

  it('protects identity management from removing the final sign-in method', async () => {
    mockState.auth.getUserIdentities.mockResolvedValue({
      data: { identities: [{ id: 'identity-1', provider: 'google', identity_data: { email: 'aarti@example.com' } }] },
      error: null,
    });
    const { supabaseAuthProvider } = await loadAdapter();

    await expect(supabaseAuthProvider.unlinkIdentity('identity-1')).rejects.toThrow('Add another sign-in method');
    expect(mockState.auth.unlinkIdentity).not.toHaveBeenCalled();
  });
});

describe('normalizeOAuthReturnTo', () => {
  it.each([
    ['/settings', '/settings'],
    ['/lists/1?tab=tasks', '/lists/1?tab=tasks'],
    ['https://attacker.invalid', '/'],
    ['//attacker.invalid', '/'],
    ['', '/'],
    [null, '/'],
  ])('accepts only internal paths: %s', async (candidate, expected) => {
    const { normalizeOAuthReturnTo } = await loadAdapter();
    expect(normalizeOAuthReturnTo(candidate)).toBe(expected);
  });
});
