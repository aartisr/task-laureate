import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { appServices } from '../app/runtime/appServices';
import { queryKeys } from '../core/contracts/queryKeys';
import { supportsCollaboration } from '../core/contracts/repository';
import { usePageSEO } from '../hooks/usePageSEO';
import { AppIcon } from '../components/AppIcon';

function describeSharing(collaboratorCount: number, pendingInvitationCount: number) {
  const parts: string[] = [];
  if (collaboratorCount) parts.push(`${collaboratorCount} ${collaboratorCount === 1 ? 'collaborator' : 'collaborators'}`);
  if (pendingInvitationCount) parts.push(`${pendingInvitationCount} invitation${pendingInvitationCount === 1 ? '' : 's'} pending`);
  return parts.join(' · ');
}

/** Owner-facing collaboration index. Each card opens the existing List Share
 * panel, so access management continues to have one consistent home. */
export function SharedByMePage() {
  usePageSEO({ title: 'Shared by me', description: 'Lists you have shared with collaborators.', noindex: true });
  const navigate = useNavigate();
  const repository = appServices.repository;
  const enabled = supportsCollaboration(repository);
  const { data = [], isLoading, error } = useQuery({
    queryKey: queryKeys.collaboration.sharedByMe,
    queryFn: () => enabled ? repository.listListsSharedByMe() : Promise.resolve([]),
    enabled,
    staleTime: 15_000,
  });

  return <section className="shared-with-me-page" aria-labelledby="shared-by-me-title">
    <header className="shared-with-me-page__hero">
      <div><p className="shared-with-me-page__eyebrow">Collaboration</p><h1 id="shared-by-me-title">Shared by me</h1><p>See every List you have shared, including invitations still waiting for a response.</p></div>
      <Link className="secondary-button" to="/lists-overview">Your Lists</Link>
    </header>
    {!enabled ? <div className="shared-with-me-page__notice" role="status"><strong>Collaboration is not connected yet.</strong><span>Sign in and apply the collaboration migrations to view outgoing sharing here.</span></div> : null}
    {error ? <div className="shared-with-me-page__notice shared-with-me-page__notice--error" role="alert"><strong>We could not load your shared Lists.</strong><span>{error instanceof Error ? error.message : 'Please retry.'}</span></div> : null}
    {isLoading ? <p className="shared-with-me-page__loading" aria-live="polite">Loading shared Lists…</p> : null}
    {enabled && !isLoading && !error && data.length === 0 ? <div className="shared-with-me-page__empty"><span aria-hidden="true"><AppIcon name="share" /></span><h2>No Lists shared by you yet</h2><p>Share a List from its Share panel. Collaborators and pending invitations will appear here.</p></div> : null}
    {data.length ? <div className="shared-resource-grid">{data.map((list) => <article className="shared-resource-card" key={list.listId}>
      <div className="shared-resource-card__top"><span className="shared-resource-card__type">Your shared List</span><span className="shared-resource-card__role shared-resource-card__role--editor">{describeSharing(list.collaboratorCount, list.pendingInvitationCount)}</span></div>
      <h2>{list.title}</h2>{list.description ? <p>{list.description}</p> : <p className="shared-resource-card__empty-description">No description provided.</p>}
      <footer><span>{describeSharing(list.collaboratorCount, list.pendingInvitationCount)}</span><button type="button" onClick={() => navigate({ to: '/lists/$listId', params: { listId: list.listId } })}>Open List <AppIcon name="arrow-right" /></button></footer>
    </article>)}</div> : null}
  </section>;
}
