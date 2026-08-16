import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { CollaborationRepository, ShareResourceInput } from '../core/contracts/repository';
import type { Collaborator, CollaboratorRole, ShareInvitation } from '../core/domain/sharing';
import { describeRole, normalizeInvitationEmail } from '../core/domain/sharing';
import { CollaborationPersistenceError } from '../infrastructure/persistence/collaborationErrors';

export function ShareResourcePanel({ repository, resource, resourceName, onClose }: { repository: CollaborationRepository; resource: ShareResourceInput; resourceName: string; onClose: () => void }) {
  const titleId = useId();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<CollaboratorRole>('editor');
  const [invitations, setInvitations] = useState<ShareInvitation[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [sharing, setSharing] = useState(false);
  const [revokingUserId, setRevokingUserId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [collaboratorWarning, setCollaboratorWarning] = useState('');
  const [createdInvite, setCreatedInvite] = useState<{ email: string; acceptanceUrl: string } | null>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const load = async () => {
    const [invitationsResult, collaboratorsResult] = await Promise.allSettled([
      repository.listOutgoingInvitations(resource),
      repository.listCollaborators(resource),
    ]);
    if (invitationsResult.status === 'rejected') throw invitationsResult.reason;
    setInvitations(invitationsResult.value);
    if (collaboratorsResult.status === 'fulfilled') {
      setCollaborators(collaboratorsResult.value);
      setCollaboratorWarning('');
      return;
    }
    // Collaborator email display arrived after the original sharing flow. A
    // missing migration 035 must not prevent someone from creating an invite;
    // pending invitations remain visible and the owner can repair the optional
    // roster display independently.
    if (collaboratorsResult.reason instanceof CollaborationPersistenceError && collaboratorsResult.reason.isConfigurationFailure) {
      setCollaborators([]);
      setCollaboratorWarning('Couldn’t load collaborator emails yet. Sharing still works; apply Supabase migration 035, then reload the PostgREST schema cache to restore this roster.');
      return;
    }
    throw collaboratorsResult.reason;
  };
  useEffect(() => { void load().catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Could not load invitations.')); }, [resource.resourceId, resource.resourceType]);
  useEffect(() => {
    dialogRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  const invite = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim() || sharing) return;
    try {
      setSharing(true); setMessage('');
      const created = await repository.createShareInvitation({ ...resource, email, role });
      if (created.delivery === 'sent') { setCreatedInvite(null); setMessage(`Invitation email sent to ${normalizeInvitationEmail(email)}. Access starts only after they accept it while signed in.`); }
      else if (created.acceptanceUrl) {
        setCreatedInvite({ email: normalizeInvitationEmail(email), acceptanceUrl: created.acceptanceUrl });
        try { await navigator.clipboard.writeText(created.acceptanceUrl); setMessage('Secure invitation link copied. Send it to the invited email—access starts only after they accept it while signed in.'); }
        catch { setMessage('Invitation created. Copy and send the secure link below.'); }
      }
      setEmail(''); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not create invitation.'); }
    finally { setSharing(false); }
  };

  const revokeAccess = async (userId: string) => {
    if (revokingUserId) return;
    try {
      setRevokingUserId(userId); setMessage('');
      await repository.revokeResourceAccess({ ...resource, userId });
      setMessage('Access revoked. The collaborator can no longer open this shared work.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not revoke access.');
    } finally {
      setRevokingUserId(null);
    }
  };

  return <div className="share-resource-panel" role="dialog" aria-modal="true" aria-labelledby={titleId}>
    <div className="share-resource-panel__backdrop" onClick={onClose} aria-hidden="true" />
    <section className="share-resource-panel__content" ref={dialogRef} tabIndex={-1}>
      <header><div><p>Private sharing</p><h2 id={titleId}>Share “{resourceName}”</h2><span>Only invited people can open this {resource.resourceType}. A link never grants access by itself.</span></div><button type="button" onClick={onClose} aria-label="Close sharing">×</button></header>
      <form onSubmit={invite}>
        <label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" autoComplete="email" required /></label>
        <fieldset><legend>Permission</legend><div className="share-resource-panel__roles">
          {(['editor', 'viewer'] as const).map((candidate) => <button key={candidate} type="button" aria-pressed={role === candidate} onClick={() => setRole(candidate)}><strong>{describeRole(candidate)}</strong><span>{candidate === 'editor' ? 'Can update tasks, not sharing or List settings' : 'Can read this content, but cannot change it'}</span></button>)}
        </div></fieldset>
        <button className="primary-button" type="submit" disabled={sharing}>{sharing ? 'Creating invite…' : 'Create secure invite'}</button>
      </form>
      {message ? <p className="share-resource-panel__message" role="status">{message}</p> : null}
      {createdInvite ? <section className="share-resource-panel__delivery" aria-label="Send invitation"><h3>Finish inviting {createdInvite.email}</h3><ol><li>Send this private link to the invited email.</li><li>They must open it while signed in to that same email.</li><li>After acceptance, the List appears in their <strong>Shared with me</strong> area.</li></ol><div><input readOnly value={createdInvite.acceptanceUrl} aria-label="Secure invitation link" /><button type="button" className="secondary-button" onClick={() => void navigator.clipboard.writeText(createdInvite.acceptanceUrl).then(() => setMessage('Invitation link copied.')).catch(() => setMessage('Select and copy the invitation link.'))}>Copy link</button></div></section> : null}
      <section aria-label="Current collaborators"><h3>Current collaborators</h3>{collaboratorWarning ? <p className="share-resource-panel__message" role="status">{collaboratorWarning}</p> : collaborators.length ? <ul>{collaborators.map((collaborator) => <li key={collaborator.userId}><span>{collaborator.email}</span><span>{describeRole(collaborator.role)} <button type="button" className="share-resource-panel__revoke" disabled={revokingUserId !== null} onClick={() => void revokeAccess(collaborator.userId)}>{revokingUserId === collaborator.userId ? 'Revoking…' : 'Remove access'}</button></span></li>)}</ul> : <p>No accepted collaborators yet.</p>}</section>
      <section aria-label="Pending invitations"><h3>Pending invitations</h3>{invitations.filter((invite) => invite.status === 'pending').length ? <ul>{invitations.filter((invite) => invite.status === 'pending').map((invite) => <li key={invite.id}><span>{invite.email}</span><span>{describeRole(invite.role)} · Expires {new Date(invite.expiresAt).toLocaleDateString()} <button type="button" className="share-resource-panel__revoke" onClick={() => void repository.revokeShareInvitation(invite.id).then(load).catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Could not revoke invitation.'))}>Revoke</button></span></li>)}</ul> : <p>No pending invitations.</p>}</section>
    </section>
  </div>;
}
