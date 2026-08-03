import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { appServices } from '../app/runtime/appServices';
import { supportsCollaboration } from '../core/contracts/repository';
import { describeRole } from '../core/domain/sharing';
import { usePageSEO } from '../hooks/usePageSEO';

export function SharedWithMePage() {
  usePageSEO({ title: 'Shared with me', description: 'Lists and Tasks shared directly with you.', noindex: true });
  const navigate = useNavigate();
  const repository = appServices.repository;
  const enabled = supportsCollaboration(repository);
  const { data = [], isLoading, error } = useQuery({ queryKey: ['collaboration', 'shared-with-me'], queryFn: () => enabled ? repository.listSharedResources() : Promise.resolve([]), enabled, staleTime: 15_000 });

  return <section className="shared-with-me-page" aria-labelledby="shared-with-me-title">
    <header className="shared-with-me-page__hero">
      <div><p className="shared-with-me-page__eyebrow">Collaboration</p><h1 id="shared-with-me-title">Shared with me</h1><p>Work shared directly with you stays distinct from your personal Lists.</p></div>
      <Link className="secondary-button" to="/lists-overview">Your Lists</Link>
    </header>
    {!enabled ? <div className="shared-with-me-page__notice" role="status"><strong>Collaboration is not connected yet.</strong><span>Sign in and apply migrations 005–009 to view invited work here.</span></div> : null}
    {error ? <div className="shared-with-me-page__notice shared-with-me-page__notice--error" role="alert"><strong>We could not load shared work.</strong><span>{error instanceof Error ? error.message : 'Please retry.'}</span></div> : null}
    {isLoading ? <p className="shared-with-me-page__loading" aria-live="polite">Loading shared work…</p> : null}
    {enabled && !isLoading && !error && data.length === 0 ? <div className="shared-with-me-page__empty"><span aria-hidden="true">✦</span><h2>Nothing shared with you yet</h2><p>When someone grants you access, it will appear here—separate from your own Lists.</p></div> : null}
    {data.length ? <div className="shared-resource-grid">{data.map((resource) => <article className="shared-resource-card" key={`${resource.resourceType}:${resource.resourceId}`}>
      <div className="shared-resource-card__top"><span className="shared-resource-card__type">{resource.resourceType === 'list' ? 'Shared List' : 'Shared Task'}</span><span className={`shared-resource-card__role shared-resource-card__role--${resource.role}`}>{describeRole(resource.role)}</span></div>
      <h2>{resource.title}</h2>{resource.description ? <p>{resource.description}</p> : <p className="shared-resource-card__empty-description">No description provided.</p>}
      <footer><span>Shared access</span><button type="button" onClick={() => resource.resourceType === 'list' ? navigate({ to: '/lists/$listId', params: { listId: resource.resourceId } }) : navigate({ to: '/tasks' })}>Open {resource.resourceType === 'list' ? 'List' : 'Task'} <span aria-hidden="true">→</span></button></footer>
    </article>)}</div> : null}
  </section>;
}
