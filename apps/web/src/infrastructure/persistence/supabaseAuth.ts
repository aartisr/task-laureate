import { createClient, type Provider, type Session, type SupabaseClient } from '@supabase/supabase-js';
import type { AuthIdentity, AuthProvider, AuthSession, EmailConfirmationAuthProvider, PasswordAuthProvider, SocialAuthProvider } from '../../core/contracts/auth';

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const storageKey = 'task-laureate.supabase-auth';
const callbackPath = '/auth/callback';
const returnToStorageKey = 'task-laureate.auth-return-to';
const authRequestTimeoutMs = 15_000;
const authCallbackTimeoutMs = 20_000;
// A control in a browser can reliably end this browser's session.  Global
// revocation also requires a live, valid server-side session and can fail for
// an already-expired or otherwise stale token, leaving a person unable to
// leave the app on a shared device.
const deviceSignOutScope = 'local' as const;
let oauthCallbackInFlight: Promise<AuthSession> | null = null;

/**
 * Supabase Auth v2 can select Navigator LockManager automatically. A browser
 * can retain one of those locks after a suspended/crashed tab, leaving client
 * initialization and `getSession()` pending forever. This application has one
 * module-singleton client and bounded network requests, so an in-process lock
 * is both sufficient here and avoids that browser-specific deadlock path.
 */
async function singleClientAuthLock<T>(_name: string, _acquireTimeout: number, operation: () => Promise<T>): Promise<T> {
  return operation();
}

/** Give a person a useful recovery path even if a browser extension or SDK stalls. */
async function settleAuthOperation<T>(operation: Promise<T>, timeoutMessage: string): Promise<T> {
  let timeout: number | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timeout = window.setTimeout(() => reject(new Error(timeoutMessage)), authCallbackTimeoutMs);
      }),
    ]);
  } finally {
    if (timeout !== undefined) window.clearTimeout(timeout);
  }
}

export const isSupabaseAuthConfigured = Boolean(url && publishableKey && !url.includes('your-project') && publishableKey !== 'your_publishable_key');

const browserStorage = {
  getItem: (key: string) => typeof window === 'undefined' ? null : window.localStorage.getItem(key),
  setItem: (key: string, value: string) => { if (typeof window !== 'undefined') window.localStorage.setItem(key, value); },
  removeItem: (key: string) => { if (typeof window !== 'undefined') window.localStorage.removeItem(key); },
};

/** Abort stalled Auth requests instead of leaving a person on a permanent spinner. */
async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), authRequestTimeoutMs);
  const upstreamSignal = init?.signal;
  const abortFromUpstream = () => controller.abort();
  upstreamSignal?.addEventListener('abort', abortFromUpstream, { once: true });
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
    upstreamSignal?.removeEventListener('abort', abortFromUpstream);
  }
}

const client: SupabaseClient | null = isSupabaseAuthConfigured
  ? createClient(url!, publishableKey!, {
      auth: {
        storage: browserStorage,
        storageKey,
        persistSession: true,
        autoRefreshToken: true,
        // The dedicated callback route explicitly exchanges the one-time PKCE
        // code. This prevents a competing automatic exchange and gives the UI
        // a single, observable completion path.
        detectSessionInUrl: false,
        flowType: 'pkce',
        lock: singleClientAuthLock,
      },
      global: { fetch: fetchWithTimeout },
    })
  : null;

function requireClient(): SupabaseClient {
  if (!client) throw new Error('Supabase Auth is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.');
  return client;
}

function toAuthSession(session: Session | null): AuthSession | null {
  if (!session?.user?.id) return null;
  return {
    user: {
      id: session.user.id,
      email: session.user.email,
      provider: typeof session.user.app_metadata.provider === 'string' ? session.user.app_metadata.provider : null,
    },
    accessToken: session.access_token,
  };
}

function callbackUrl() {
  if (typeof window === 'undefined') throw new Error('OAuth sign-in must start in a browser.');
  return `${window.location.origin}${callbackPath}`;
}

function callbackCodeFromLocation(): string {
  if (typeof window === 'undefined') throw new Error('OAuth callback must complete in a browser.');
  const parameters = new URL(window.location.href).searchParams;
  const providerError = parameters.get('error_description') ?? parameters.get('error');
  if (providerError) throw new Error(`Sign-in was cancelled or rejected: ${providerError}`);
  const code = parameters.get('code');
  if (!code) throw new Error('This sign-in link is missing its one-time code. Return to Settings and try again.');
  return code;
}

function removeOAuthCodeFromAddressBar() {
  if (typeof window === 'undefined') return;
  const next = new URL(window.location.href);
  next.searchParams.delete('code');
  next.searchParams.delete('error');
  next.searchParams.delete('error_description');
  window.history.replaceState(window.history.state, '', `${next.pathname}${next.search}${next.hash}`);
}

export function normalizeOAuthReturnTo(candidate?: string | null): string {
  if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//')) return '/';
  return candidate;
}

function persistReturnTo(returnTo?: string) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(returnToStorageKey, normalizeOAuthReturnTo(returnTo ?? `${window.location.pathname}${window.location.search}`));
}

export function consumeOAuthReturnTo() {
  if (typeof window === 'undefined') return '/';
  const returnTo = normalizeOAuthReturnTo(window.sessionStorage.getItem(returnToStorageKey));
  window.sessionStorage.removeItem(returnToStorageKey);
  return returnTo;
}

const baseProvider: AuthProvider = {
  configured: isSupabaseAuthConfigured,
  async getSession() {
    if (!client) return null;
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    return toAuthSession(data.session);
  },
  async signOut() {
    if (!client) return;
    // This app's sign-out control is intentionally "this device", not
    // "every device".  Local sign-out clears Supabase's browser session and
    // emits SIGNED_OUT without depending on a remote token-revocation call.
    // That makes it safe and dependable even if a prior session is stale.
    const { error } = await client.auth.signOut({ scope: deviceSignOutScope });
    if (error) throw error;
  },
  subscribe(listener) {
    if (!client) return () => undefined;
    const { data } = client.auth.onAuthStateChange((_event, session) => listener(toAuthSession(session)));
    return () => data.subscription.unsubscribe();
  },
};

const passwordCapability: PasswordAuthProvider = {
  ...baseProvider,
  async signIn({ email, password }) {
    const { data, error } = await requireClient().auth.signInWithPassword({ email, password });
    if (error) throw error;
    return toAuthSession(data.session);
  },
  async signUp({ email, password }) {
    const { data, error } = await requireClient().auth.signUp({ email, password, options: { emailRedirectTo: callbackUrl() } });
    if (error) throw error;
    return toAuthSession(data.session);
  },
};

const emailConfirmationCapability: EmailConfirmationAuthProvider = {
  ...baseProvider,
  async resendSignupConfirmation({ email }) {
    const { error } = await requireClient().auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: callbackUrl() },
    });
    if (error) throw error;
  },
};

const socialCapability: SocialAuthProvider = {
  ...baseProvider,
  async signInWithOAuth({ provider, returnTo }) {
    persistReturnTo(returnTo);
    const { error } = await requireClient().auth.signInWithOAuth({
      provider: provider as Provider,
      // Supabase's Azure provider requires a verified email to complete the
      // identity. Other providers retain their least-privilege defaults.
      options: { redirectTo: callbackUrl(), ...(provider === 'azure' ? { scopes: 'email' } : {}) },
    });
    if (error) {
      if (typeof window !== 'undefined') window.sessionStorage.removeItem(returnToStorageKey);
      throw error;
    }
  },
  async completeOAuthCallback() {
    if (oauthCallbackInFlight) return oauthCallbackInFlight;
    oauthCallbackInFlight = (async () => {
      if (typeof window === 'undefined') throw new Error('OAuth callback must complete in a browser.');
      try {
        const code = callbackCodeFromLocation();
        console.info('[Task-Laureate auth] Exchanging the OAuth callback code.');
        const { data, error } = await settleAuthOperation(
          requireClient().auth.exchangeCodeForSession(code),
          'Sign-in did not finish in time. Return to Settings and try again.',
        );
        if (error) throw error;
        if (!data.session) throw new Error('Sign-in was not completed. Please return to Settings and try again.');
        removeOAuthCodeFromAddressBar();
        console.info('[Task-Laureate auth] OAuth callback session is ready.');
        return toAuthSession(data.session)!;
      } catch (error) {
        if ((error instanceof DOMException && error.name === 'AbortError') || (error instanceof Error && /did not finish in time/.test(error.message))) {
          console.warn('[Task-Laureate auth] OAuth callback exchange timed out after 15 seconds.');
          throw new Error('Sign-in took too long. Check your connection, then return to Settings and try again.');
        }
        console.error('[Task-Laureate auth] OAuth callback exchange failed.', { message: error instanceof Error ? error.message : String(error) });
        throw error;
      }
    })().finally(() => { oauthCallbackInFlight = null; });
    return oauthCallbackInFlight;
  },
  async getIdentities(): Promise<AuthIdentity[]> {
    const { data, error } = await requireClient().auth.getUserIdentities();
    if (error) throw error;
    return (data.identities ?? []).map((identity) => ({
      id: identity.id,
      provider: identity.provider,
      email: identity.identity_data?.email as string | undefined,
      createdAt: identity.created_at,
      lastSignInAt: identity.last_sign_in_at,
    }));
  },
  async linkIdentity(provider) {
    const { error } = await requireClient().auth.linkIdentity({ provider: provider as Provider, options: { redirectTo: callbackUrl() } });
    if (error) throw error;
  },
  async unlinkIdentity(identityId) {
    const identities = await this.getIdentities();
    const identity = identities.find((candidate) => candidate.id === identityId);
    if (!identity) throw new Error('That sign-in method is no longer available. Refresh and try again.');
    if (identities.length < 2) throw new Error('Add another sign-in method before removing your only way to access this account.');
    const { data, error } = await requireClient().auth.getUserIdentities();
    if (error) throw error;
    const supabaseIdentity = data.identities?.find((candidate) => candidate.id === identityId);
    if (!supabaseIdentity) throw new Error('That sign-in method is no longer available. Refresh and try again.');
    const { error: unlinkError } = await requireClient().auth.unlinkIdentity(supabaseIdentity);
    if (unlinkError) throw unlinkError;
  },
};

/** A single adapter offering optional password and OAuth/OIDC capabilities. */
export const supabaseAuthProvider: PasswordAuthProvider & SocialAuthProvider & EmailConfirmationAuthProvider = {
  ...passwordCapability,
  ...emailConfirmationCapability,
  ...socialCapability,
};
