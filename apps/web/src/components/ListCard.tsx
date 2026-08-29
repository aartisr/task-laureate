import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import type { TodoList } from '../core/contracts/domain';
import { archiveRecommendation } from '../core/domain/listLifecycle';
import { announceToScreenReader } from '../lib/a11y';
import { AppIcon } from './AppIcon';
import { FavoriteListButton } from './FavoriteListButton';
import { ListShareButton } from './ListShareButton';
import { ListStatusBadge } from './ListStatusBadge';
import { ProgressRing } from './ProgressRing';
import '../styles/components/list-card.css';

export interface ListCardProps {
  list: TodoList;
  canManage: boolean;
  onDelete: () => Promise<void>;
  onArchive: () => Promise<void>;
  onRestore: () => Promise<void>;
  onReuse: () => Promise<void>;
  onShare: () => void;
}

/** One action-complete list representation, reusable in collections and shelves. */
export function ListCard({ list, onDelete, onArchive, onRestore, onReuse, onShare, canManage }: ListCardProps) {
  const remaining = list.taskCount - list.completedTaskCount;
  const [manageOpen, setManageOpen] = useState(false);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const run = async (action: () => Promise<void>) => {
    setIsSaving(true);
    try { await action(); setManageOpen(false); setDeleteArmed(false); }
    catch { announceToScreenReader('That change could not be saved. Please try again.', 'assertive'); }
    finally { setIsSaving(false); }
  };
  return <article className="list-card">
    <div className="list-card__header"><div className="list-card__meta"><ListStatusBadge status={list.status} /><span className="list-card__date">{new Date(list.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span></div><ProgressRing percent={list.completionPercent} size={52} /></div>
    <h3 className="list-card__title">{list.title}</h3>
    {list.description ? <p className="list-card__desc">{list.description}</p> : null}
    <div className="list-card__bar"><div className="list-card__bar-fill" style={{ '--bar-pct': `${list.completionPercent}%` } as React.CSSProperties} /></div>
    <div className="list-card__footer"><span>{list.completedTaskCount}/{list.taskCount} tasks</span>{remaining > 0 ? <span className="list-card__remaining">{remaining} remaining</span> : null}{list.completionPercent === 100 ? <span className="list-card__done"><AppIcon name="check" /> Done</span> : null}</div>
    <div className="list-card__actions">
      <Link to="/lists/$listId" params={{ listId: list.id }} className="primary-button list-card__open"><span>Open list</span> <AppIcon name="arrow-right" /></Link>
      <div className="list-card__secondary-actions">
        <FavoriteListButton listId={list.id} listTitle={list.title} className="list-card__keep-handy" />
        {canManage ? <><ListShareButton listTitle={list.title} onClick={onShare} /><button type="button" aria-expanded={manageOpen} className="secondary-button list-card__manage" onClick={() => setManageOpen((open) => !open)}><AppIcon name="more" /><span>More</span></button></> : null}
      </div>
    </div>
    {canManage && manageOpen ? <div className="list-card__menu" aria-label={`Manage ${list.title}`}>
      {list.status === 'completed' ? <><p className="list-card__menu-copy">This run is complete. Its history is preserved.</p><button type="button" className="list-card__menu-action list-card__menu-action--archive" disabled={isSaving} onClick={() => void run(onReuse)}><AppIcon name="undo" /> Start a fresh run</button></> : null}
      {list.status === 'archived' ? <button type="button" className="list-card__menu-action list-card__menu-action--archive" disabled={isSaving} onClick={() => void run(onRestore)}><AppIcon name="undo" /> Restore to {list.archivedFromStatus === 'completed' ? 'completed' : 'in progress'}</button> : <button type="button" className="list-card__menu-action list-card__menu-action--archive" disabled={isSaving} onClick={() => void run(onArchive)}><AppIcon name="archive" /> {archiveRecommendation(list) ? 'Archive recommended' : 'Archive from daily view'}</button>}
      {deleteArmed ? <div className="list-card__danger"><span>Move to deleted items? You can undo this.</span><div className="list-card__danger-actions"><button type="button" className="list-card__menu-action list-card__menu-action--danger" disabled={isSaving} onClick={() => void run(onDelete)}><AppIcon name="trash" /> Yes, delete</button><button type="button" className="list-card__menu-action list-card__menu-action--cancel" onClick={() => setDeleteArmed(false)}>Cancel</button></div></div> : <button type="button" className="list-card__menu-action list-card__menu-action--delete" onClick={() => setDeleteArmed(true)}><AppIcon name="trash" /> Delete list…</button>}
    </div> : null}
  </article>;
}
