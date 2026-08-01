import { useEffect, useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import type { AuthProvider, AuthSession } from '../core/contracts/auth';
import { getPersistenceStatus, subscribeToPersistenceStatus, type PersistenceStatus } from '../infrastructure/persistence/status';

interface AccountStatusProps {
  provider: AuthProvider;
  onNavigate?: () => void;
}

function statusLabel(status: PersistenceStatus, isSignedIn: boolean) {
  if (!isSignedIn) return status.phase === 'error' ? 'Sync needs attention' : 'Sign in to sync';
  if (status.phase === 'synced') return 'Cloud sync on';
  if (status.phase === 'saving') return 'Saving changes';
  if (status.phase === 'connecting') return 'Connecting';
  if (status.phase === 'error') return 'Sync needs attention';
  return 'Local workspace';
}

function accountInitial(session: AuthSession | null) {
  const identity = session?.user.email ?? session?.user.id;
  return identity ? identity.trim().charAt(0).toUpperCase() : '?';
}

/** Persistent, provider-neutral account identity and cloud-sync entry point. */
export function AccountStatus({ provider, onNavigate }: AccountStatusProps) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [persistence, setPersistence] = useState(getPersistenceStatus);

  useEffect(() => {
    if (!provider.configured) return;
    void provider.getSession().then(setSession).catch(() => setSession(null));
    return provider.subscribe(setSession);
  }, [provider]);

  useEffect(() => subscribeToPersistenceStatus(setPersistence), []);

  const signedIn = Boolean(session);
  const identity = session?.user.email ?? (signedIn ? 'Signed-in account' : 'Not signed in');
  const syncLabel = useMemo(
    () => provider.configured ? statusLabel(persistence, signedIn) : 'Cloud sync unavailable',
    [persistence, provider.configured, signedIn],
  );
  const stateClass = persistence.phase === 'error' ? 'is-error' : signedIn && persistence.phase === 'synced' ? 'is-synced' : '';
  const destination = signedIn ? '/settings' : '/sign-in';

  return (
    <Link
      to={destination}
      className={`account-status ${stateClass}`}
      aria-label={signedIn
        ? `${identity}. ${syncLabel}. Open account and cloud sync settings.`
        : `${syncLabel}. Open sign-in.`}
      onClick={onNavigate}
    >
      <span className="account-status__avatar" aria-hidden="true">{accountInitial(session)}</span>
      <span className="account-status__content">
        <strong>{identity}</strong>
        <small><span className="account-status__indicator" aria-hidden="true" />{syncLabel}</small>
      </span>
      <span className="account-status__chevron" aria-hidden="true">›</span>
    </Link>
  );
}
