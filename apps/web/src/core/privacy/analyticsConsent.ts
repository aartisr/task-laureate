/**
 * Versioned, storage-backed analytics consent state.
 *
 * Three possible decisions:
 *   'unknown'  – user has not yet been asked (default; collection must be off)
 *   'granted'  – user explicitly opted in
 *   'denied'   – user explicitly declined or withdrew
 *
 * The version number (from VITE_POSTHOG_CONSENT_VERSION) is stored alongside
 * the decision. When the version bumps (because data practices changed) any
 * stored decision is treated as 'unknown' and the user is re-prompted.
 *
 * This module never reads or writes task, list, or user-content data.
 */

export type ConsentDecision = 'unknown' | 'granted' | 'denied';

const KEY_DECISION = 'tl:analytics:consent';
const KEY_VERSION = 'tl:analytics:consent:version';

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

interface StoredConsent {
  readonly decision: ConsentDecision;
  readonly version: number;
}

function readStorage(): StoredConsent | null {
  try {
    const raw = localStorage.getItem(KEY_DECISION);
    const version = Number(localStorage.getItem(KEY_VERSION) ?? '0');
    if (raw !== 'granted' && raw !== 'denied') return null;
    return { decision: raw as ConsentDecision, version };
  } catch {
    return null;
  }
}

function writeStorage(decision: 'granted' | 'denied', version: number): void {
  try {
    localStorage.setItem(KEY_DECISION, decision);
    localStorage.setItem(KEY_VERSION, String(version));
  } catch {
    // localStorage unavailable (private browsing, storage quota, etc.)
    // The in-memory state still applies for this session.
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the stored consent decision for the given version.
 * Returns 'unknown' if no decision has been made, or if the stored decision
 * was for a different (older) version of the consent statement.
 */
export function getConsentDecision(consentVersion: number): ConsentDecision {
  const stored = readStorage();
  if (!stored || stored.version !== consentVersion) return 'unknown';
  return stored.decision;
}

/** Persist a consent decision and notify all subscribers */
export function setConsentDecision(decision: 'granted' | 'denied', consentVersion: number): void {
  writeStorage(decision, consentVersion);
  notifySubscribers(decision);
}

/** Withdraw consent – alias for setConsentDecision('denied', ...) */
export function withdrawConsent(consentVersion: number): void {
  setConsentDecision('denied', consentVersion);
}

// ---------------------------------------------------------------------------
// Subscription (reactive consent for React components and the analytics sink)
// ---------------------------------------------------------------------------

type ConsentSubscriber = (decision: ConsentDecision) => void;
const subscribers = new Set<ConsentSubscriber>();

/**
 * Subscribe to consent changes. Returns an unsubscribe cleanup function.
 * Safe to call in React useEffect.
 */
export function subscribeToConsent(cb: ConsentSubscriber): () => void {
  subscribers.add(cb);
  return () => { subscribers.delete(cb); };
}

function notifySubscribers(decision: ConsentDecision): void {
  subscribers.forEach((cb) => {
    try { cb(decision); } catch { /* subscriber errors must not propagate */ }
  });
}
