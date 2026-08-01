import type { AuthSession, PasswordAuthProvider } from '../../core/contracts/auth';

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const storageKey = 'task-laureate.supabase-auth';

export interface SupabaseSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: { id: string; email?: string | null };
}

type AuthListener = (session: SupabaseSession | null) => void;
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
let refreshInFlight: Promise<SupabaseSession | null> | null = null;
const listeners = new Set<AuthListener>();

export const isSupabaseAuthConfigured = Boolean(url && publishableKey && !url.includes('your-project') && publishableKey !== 'your_publishable_key');

function endpoint(path: string) {
  if (!isSupabaseAuthConfigured) throw new Error('Supabase Auth is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.');
  return `${url!.replace(/\/$/, '')}/auth/v1${path}`;
}

function readSession(): SupabaseSession | null {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<SupabaseSession>;
    if (!value.access_token || !value.refresh_token || !value.expires_at || !value.user?.id) return null;
    return value as SupabaseSession;
  } catch {
    return null;
  }
}

function emit(session: SupabaseSession | null) {
  listeners.forEach((listener) => listener(session));
}

function scheduleRefresh(session: SupabaseSession) {
  if (refreshTimer) clearTimeout(refreshTimer);
  // Refresh before expiry so an in-flight workspace save never starts with a stale JWT.
  const delay = Math.max(1_000, session.expires_at * 1_000 - Date.now() - 60_000);
  refreshTimer = setTimeout(() => { void refreshSession().catch((error) => console.error('[Task-Laureate auth] Session refresh failed.', error)); }, delay);
}

function saveSession(session: SupabaseSession | null, notify = true) {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = undefined;
  try {
    if (session) {
      window.localStorage.setItem(storageKey, JSON.stringify(session));
      scheduleRefresh(session);
    } else {
      window.localStorage.removeItem(storageKey);
    }
  } catch (error) {
    console.error('[Task-Laureate auth] Could not persist the browser session.', error);
  }
  if (notify) emit(session);
}

async function importSessionFromRedirect(): Promise<SupabaseSession | null> {
  if (typeof window === 'undefined' || !window.location.hash.includes('access_token=')) return null;
  const parameters = new URLSearchParams(window.location.hash.slice(1));
  const accessToken = parameters.get('access_token');
  const refreshToken = parameters.get('refresh_token');
  if (!accessToken || !refreshToken) return null;
  const response = await fetch(endpoint('/user'), { headers: { apikey: publishableKey!, Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error('The confirmation link did not produce a valid Supabase session. Please sign in again.');
  const user = await response.json() as SupabaseSession['user'];
  const session: SupabaseSession = {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: Number(parameters.get('expires_at')) || Math.floor(Date.now() / 1_000) + Number(parameters.get('expires_in') ?? 3_600),
    user,
  };
  window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
  saveSession(session);
  return session;
}

async function requestSession(path: string, body: Record<string, unknown>): Promise<SupabaseSession | null> {
  const response = await fetch(endpoint(path), {
    method: 'POST',
    headers: { apikey: publishableKey!, Authorization: `Bearer ${publishableKey!}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json() as Partial<SupabaseSession> & { message?: string; error_description?: string };
  if (!response.ok) throw new Error(data.error_description ?? data.message ?? `Supabase Auth failed (HTTP ${response.status}).`);
  if (!data.access_token || !data.refresh_token || !data.user?.id) return null; // Email confirmation may defer the session.
  const session: SupabaseSession = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at ?? Math.floor(Date.now() / 1_000) + 3_600,
    user: data.user,
  };
  saveSession(session);
  return session;
}

export async function refreshSession(): Promise<SupabaseSession | null> {
  if (refreshInFlight) return refreshInFlight;
  const existing = readSession();
  if (!existing) return null;
  refreshInFlight = requestSession('/token?grant_type=refresh_token', { refresh_token: existing.refresh_token })
    .catch((error) => {
      saveSession(null);
      throw error;
    })
    .finally(() => { refreshInFlight = null; });
  return refreshInFlight;
}

export async function getSupabaseSession(): Promise<SupabaseSession | null> {
  const redirectedSession = await importSessionFromRedirect();
  if (redirectedSession) return redirectedSession;
  const session = readSession();
  if (!session) return null;
  if (session.expires_at * 1_000 <= Date.now() + 60_000) return refreshSession();
  scheduleRefresh(session);
  return session;
}

export async function signInWithPassword(email: string, password: string) {
  return requestSession('/token?grant_type=password', { email, password });
}

export async function signUp(email: string, password: string) {
  return requestSession('/signup', { email, password, data: {}, email_redirect_to: window.location.origin });
}

export async function signOut() {
  const session = readSession();
  try {
    if (session) await fetch(endpoint('/logout'), { method: 'POST', headers: { apikey: publishableKey!, Authorization: `Bearer ${session.access_token}` } });
  } finally {
    saveSession(null);
  }
}

export function subscribeToSupabaseAuth(listener: AuthListener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/**
 * Supabase implementation of the app's generic auth contract. To use another
 * identity system, replace this adapter at the composition root only.
 */
function toAuthSession(session: SupabaseSession | null): AuthSession | null {
  return session && { user: session.user, accessToken: session.access_token };
}

export const supabaseAuthProvider: PasswordAuthProvider = {
  configured: isSupabaseAuthConfigured,
  getSession: async () => toAuthSession(await getSupabaseSession()),
  signIn: async ({ email, password }) => toAuthSession(await signInWithPassword(email, password)),
  signUp: async ({ email, password }) => toAuthSession(await signUp(email, password)),
  signOut,
  subscribe(listener) {
    return subscribeToSupabaseAuth((session) => listener(toAuthSession(session)));
  },
};
