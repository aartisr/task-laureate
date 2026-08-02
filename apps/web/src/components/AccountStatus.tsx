import { useEffect, useId, useMemo, useRef, useState } from 'react';
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!signedIn) setMenuOpen(false);
  }, [signedIn]);

  useEffect(() => {
    if (!menuOpen) return;

    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };

    document.addEventListener('pointerdown', closeOnOutsidePress);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [menuOpen]);

  const signOut = async () => {
    setSigningOut(true);
    setMessage(null);
    try {
      await provider.signOut();
      setMenuOpen(false);
      onNavigate?.();
    } catch (error) {
      console.error('[Task-Laureate auth] Account-menu sign-out failed.', { error });
      setMessage('We could not sign you out on this device. Please try again.');
    } finally {
      setSigningOut(false);
    }
  };

  if (!signedIn) {
    return (
      <Link
        to={destination}
        className={`account-status ${stateClass}`}
        aria-label={`${syncLabel}. Open sign-in.`}
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

  return (
    <div className="account-status-menu" ref={containerRef}>
      <button
        type="button"
        className={`account-status ${stateClass}`}
        aria-label={`${identity}. ${syncLabel}. Open account menu.`}
        aria-expanded={menuOpen}
        aria-controls={menuId}
        aria-haspopup="menu"
        onClick={() => setMenuOpen((open) => !open)}
      >
      <span className="account-status__avatar" aria-hidden="true">{accountInitial(session)}</span>
      <span className="account-status__content">
        <strong>{identity}</strong>
        <small><span className="account-status__indicator" aria-hidden="true" />{syncLabel}</small>
      </span>
      <span className="account-status__chevron" aria-hidden="true">›</span>
      </button>
      {menuOpen ? <div id={menuId} className="account-status__popover" role="menu" aria-label="Account menu">
        <div className="account-status__identity">
          <span className="account-status__avatar" aria-hidden="true">{accountInitial(session)}</span>
          <span><strong>{identity}</strong><small>{session?.user.provider ? `Signed in with ${session.user.provider}` : 'Signed-in account'}</small></span>
        </div>
        <Link to="/settings" className="account-status__menu-item" role="menuitem" onClick={() => { setMenuOpen(false); onNavigate?.(); }}>
          Account &amp; sync settings
        </Link>
        <button className="account-status__menu-item account-status__sign-out" type="button" role="menuitem" onClick={() => void signOut()} disabled={signingOut}>
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
        {message ? <p className="account-status__message" role="status">{message}</p> : null}
      </div> : null}
    </div>
  );
}
