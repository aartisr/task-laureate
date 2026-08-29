import type { CollaboratorRole } from '../core/domain/sharing';
import './ListAccessBanner.css';
import { AppIcon } from './AppIcon';

export interface ListAccessBannerProps {
  role: CollaboratorRole;
}

/**
 * A persistent, plain-language explanation of the recipient's access.
 * It deliberately does not expose the owner or collaborator roster.
 */
export function ListAccessBanner({ role }: ListAccessBannerProps) {
  const canEdit = role === 'editor';
  return <section className={`list-access-banner list-access-banner--${role}`} aria-label={`Shared list: ${canEdit ? 'can update tasks' : 'read-only access'}`}>
    <span className="list-access-banner__icon" aria-hidden="true"><AppIcon name={canEdit ? 'spark' : 'help'} /></span>
    <div className="list-access-banner__copy">
      <p>Shared with you</p>
      <h2>{canEdit ? 'You can update tasks' : 'You have read-only access'}</h2>
      <span>{canEdit ? 'Add, complete, reorder, and update tasks. List settings and sharing remain with the owner.' : 'You can view every task and its details, but only the owner can make changes.'}</span>
    </div>
    <span className="list-access-banner__role">{canEdit ? 'Can update' : 'Read-only'}</span>
  </section>;
}
