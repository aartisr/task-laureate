import type { TodoListInput, TodoTaskInput } from '../contracts/repository';
import { authProvider } from '../../config/persistence.config';
import { normalizeOAuthReturnTo } from '../../infrastructure/persistence/supabaseAuth';

const storageKey = 'task-laureate.pending-save.v1';

export type PendingSaveIntent =
  | { kind: 'list'; input: TodoListInput; returnTo: string }
  | { kind: 'task'; input: TodoTaskInput; returnTo: string };

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

/** Stores one same-tab draft before authentication. It is never put in a URL. */
export function savePendingSaveIntent(intent: PendingSaveIntent) {
  if (!canUseStorage()) return;
  window.sessionStorage.setItem(storageKey, JSON.stringify({ ...intent, returnTo: normalizeOAuthReturnTo(intent.returnTo) }));
}

export function getPendingSaveIntent(): PendingSaveIntent | null {
  if (!canUseStorage()) return null;
  try {
    const value: unknown = JSON.parse(window.sessionStorage.getItem(storageKey) ?? 'null');
    if (!value || typeof value !== 'object') return null;
    const candidate = value as Partial<PendingSaveIntent>;
    if ((candidate.kind !== 'list' && candidate.kind !== 'task') || !candidate.input || typeof candidate.returnTo !== 'string') return null;
    return { ...candidate, returnTo: normalizeOAuthReturnTo(candidate.returnTo) } as PendingSaveIntent;
  } catch {
    return null;
  }
}

export function clearPendingSaveIntent() {
  if (canUseStorage()) window.sessionStorage.removeItem(storageKey);
}

export function pendingSaveSummary(intent: PendingSaveIntent | null) {
  if (!intent) return null;
  const title = typeof intent.input.title === 'string' ? intent.input.title.trim() : '';
  return intent.kind === 'list'
    ? `Your list${title ? ` “${title}”` : ''} is ready to save after sign-in.`
    : `Your task${title ? ` “${title}”` : ''} is ready to save after sign-in.`;
}

/** Returns true for an authenticated save; otherwise preserves the draft and opens sign-in. */
export async function requireSignInForSave(intent: PendingSaveIntent, redirect: (url: string) => void = (url) => window.location.assign(url)) {
  const session = await authProvider.getSession().catch(() => null);
  if (session) return true;
  savePendingSaveIntent(intent);
  if (typeof window !== 'undefined') {
    const returnTo = normalizeOAuthReturnTo(intent.returnTo);
    redirect(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
  }
  return false;
}
