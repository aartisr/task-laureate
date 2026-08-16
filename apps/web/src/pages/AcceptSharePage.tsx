import { useEffect, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { appServices } from '../app/runtime/appServices';
import { supportsCollaboration } from '../core/contracts/repository';
import { describeRole } from '../core/domain/sharing';
import { usePageSEO } from '../hooks/usePageSEO';
import { authProvider } from '../config/persistence.config';
import { CollaborationPersistenceError } from '../infrastructure/persistence/collaborationErrors';

type State = { kind: 'loading' } | { kind: 'success'; role: 'editor' | 'viewer'; resourceType: 'list' | 'task'; resourceId: string } | { kind: 'error'; message: string; reason?: 'account-mismatch'; signedInEmail?: string | null };

export function AcceptSharePage() {
  usePageSEO({ title: 'Accept invitation', description: 'Accept a private Task Laureate collaboration invitation.', noindex: true });
  const navigate = useNavigate();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [switchingAccount, setSwitchingAccount] = useState(false);
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    const repository = appServices.repository;
    if (!token) { setState({ kind: 'error', message: 'This invitation link is incomplete. Ask the List owner to send a fresh invite.' }); return; }
    void authProvider.getSession().catch(() => null).then((session) => {
      if (!supportsCollaboration(repository)) {
        setState({ kind: 'error', message: 'Sign in to the account that received this invitation, then reopen this link.', signedInEmail: session?.user.email });
        return;
      }
      return repository.acceptShareInvitation(token)
        .then((accepted) => setState({ kind: 'success', ...accepted }))
        .catch((error: unknown) => setState({
          kind: 'error',
          message: error instanceof Error ? error.message : 'This invitation could not be accepted.',
          reason: error instanceof CollaborationPersistenceError && error.reason === 'invitation-account-mismatch' ? 'account-mismatch' : undefined,
          signedInEmail: session?.user.email,
        }));
    });
  }, []);

  const switchAccount = async () => {
    setSwitchingAccount(true);
    try {
      await authProvider.signOut();
      const returnTo = `${window.location.pathname}${window.location.search}`;
      window.location.assign(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
    } catch {
      setSwitchingAccount(false);
      setState({ kind: 'error', message: 'We could not switch accounts on this device. Open Settings to sign out, then reopen this invitation.', reason: 'account-mismatch', signedInEmail: state.kind === 'error' ? state.signedInEmail : undefined });
    }
  };

  if (state.kind === 'loading') return <main className="share-accept-page"><section className="share-accept-card" aria-live="polite"><p>Private invitation</p><h1>Checking your access…</h1><span>Your link is matched to the email it was sent to.</span></section></main>;
  if (state.kind === 'error' && state.reason === 'account-mismatch') return <main className="share-accept-page"><section className="share-accept-card share-accept-card--recovery"><p>Private invitation</p><span className="share-accept-card__signal" aria-hidden="true">↔</span><h1>This invite is for a different account.</h1><span>To protect the owner’s work, an invitation can only be accepted by the email it was sent to.</span>{state.signedInEmail ? <div className="share-accept-card__account"><small>You’re signed in as</small><strong>{state.signedInEmail}</strong></div> : null}<div className="share-accept-card__actions"><button className="primary-button" type="button" onClick={() => void switchAccount()} disabled={switchingAccount}>{switchingAccount ? 'Switching account…' : 'Use a different account'} <span aria-hidden="true">→</span></button><Link className="share-accept-card__secondary" to="/">Return to Task Laureate</Link></div><small className="share-accept-card__reassurance">The owner can resend the invitation if it was sent to the wrong email. Your personal work remains private.</small></section></main>;
  if (state.kind === 'error') return <main className="share-accept-page"><section className="share-accept-card"><p>Invitation unavailable</p><h1>We couldn’t open this shared work.</h1><span>{state.message}</span><Link className="primary-button" to="/">Go to Task Laureate</Link></section></main>;
  const destination = state.resourceType === 'list' ? () => navigate({ to: '/lists/$listId', params: { listId: state.resourceId } }) : () => navigate({ to: '/shared-with-me' });
  return <main className="share-accept-page"><section className="share-accept-card"><p>Access granted</p><h1>You can {describeRole(state.role).toLowerCase()} this {state.resourceType}.</h1><span>It is now in <strong>Shared with me</strong>, separate from your personal work.</span><button className="primary-button" type="button" onClick={destination}>Open shared {state.resourceType} <span aria-hidden="true">→</span></button><Link className="share-accept-card__secondary" to="/shared-with-me">View all shared work</Link></section></main>;
}
