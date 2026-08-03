import { useEffect, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { appServices } from '../app/runtime/appServices';
import { supportsCollaboration } from '../core/contracts/repository';
import { describeRole } from '../core/domain/sharing';
import { usePageSEO } from '../hooks/usePageSEO';

type State = { kind: 'loading' } | { kind: 'success'; role: 'editor' | 'viewer'; resourceType: 'list' | 'task'; resourceId: string } | { kind: 'error'; message: string };

export function AcceptSharePage() {
  usePageSEO({ title: 'Accept invitation', description: 'Accept a private Task Laureate collaboration invitation.', noindex: true });
  const navigate = useNavigate();
  const [state, setState] = useState<State>({ kind: 'loading' });
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    const repository = appServices.repository;
    if (!token) { setState({ kind: 'error', message: 'This invitation link is incomplete. Ask the List owner to send a fresh invite.' }); return; }
    if (!supportsCollaboration(repository)) { setState({ kind: 'error', message: 'Sign in to the invited account, then reopen this link.' }); return; }
    void repository.acceptShareInvitation(token).then((accepted) => setState({ kind: 'success', ...accepted })).catch((error: unknown) => setState({ kind: 'error', message: error instanceof Error ? error.message : 'This invitation could not be accepted.' }));
  }, []);
  if (state.kind === 'loading') return <main className="share-accept-page"><section className="share-accept-card" aria-live="polite"><p>Private invitation</p><h1>Checking your access…</h1><span>Your link is matched to the email it was sent to.</span></section></main>;
  if (state.kind === 'error') return <main className="share-accept-page"><section className="share-accept-card"><p>Invitation unavailable</p><h1>We couldn’t open this shared work.</h1><span>{state.message}</span><Link className="primary-button" to="/">Go to Task Laureate</Link></section></main>;
  const destination = state.resourceType === 'list' ? () => navigate({ to: '/lists/$listId', params: { listId: state.resourceId } }) : () => navigate({ to: '/shared-with-me' });
  return <main className="share-accept-page"><section className="share-accept-card"><p>Access granted</p><h1>You can {describeRole(state.role).toLowerCase()} this {state.resourceType}.</h1><span>It is now in <strong>Shared with me</strong>, separate from your personal work.</span><button className="primary-button" type="button" onClick={destination}>Open shared {state.resourceType} <span aria-hidden="true">→</span></button><Link className="share-accept-card__secondary" to="/shared-with-me">View all shared work</Link></section></main>;
}
