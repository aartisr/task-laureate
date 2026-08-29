import { useEffect, useMemo, useRef, useState } from 'react';
import type { TodoItem, TodoList } from '../core/contracts/domain';
import { supportsCollaboration } from '../core/contracts/repository';
import { appServices } from '../app/runtime/appServices';
import { announceToScreenReader } from '../lib/a11y';
import { AppIcon } from './AppIcon';

interface TaskMoveControlProps {
  task: TodoItem;
  currentListTitle?: string;
  onMove: (destinationListId: string) => Promise<void>;
}

function canEdit(role: 'owner' | 'editor' | 'viewer' | null) {
  return role === 'owner' || role === 'editor';
}

export function TaskMoveControl({ task, currentListTitle, onMove }: TaskMoveControlProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [lists, setLists] = useState<TodoList[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setQuery('');
    setError(null);
    setLoading(true);
    requestAnimationFrame(() => input.current?.focus());

    void (async () => {
      try {
        const repository = appServices.repository;
        const activeLists = (await repository.listLists()).filter((list) => list.id !== task.listId && list.status === 'active');
        let editableLists = activeLists;
        if (supportsCollaboration(repository)) {
          const access = await Promise.all(activeLists.map(async (list) => ({ list, role: await repository.getResourceAccess({ resourceType: 'list', resourceId: list.id }).catch(() => null) })));
          editableLists = access.filter(({ role }) => canEdit(role)).map(({ list }) => list);
        }
        if (!cancelled) setLists(editableLists);
      } catch {
        if (!cancelled) setError('We could not load your editable lists. Try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, task.listId]);

  const destinations = useMemo(() => lists.filter((list) => `${list.title} ${list.description}`.toLowerCase().includes(query.trim().toLowerCase())), [lists, query]);
  const move = async (list: TodoList) => {
    try {
      setSavingId(list.id);
      setError(null);
      await onMove(list.id);
      announceToScreenReader(`Moved “${task.title}” to ${list.title}.`);
      setOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'We could not move this task.');
    } finally {
      setSavingId(null);
    }
  };

  return <section className={`task-move-control${open ? ' is-open' : ''}`} aria-label="Move task">
    <div className="task-move-control__heading">
      <div><p>Placement</p><strong>{currentListTitle ? `In ${currentListTitle}` : 'Current list'}</strong></div>
      <button type="button" className="secondary-button" onClick={() => setOpen((value) => !value)} aria-expanded={open}><AppIcon name="move" /> Move task</button>
    </div>
    {open ? <div className="task-move-control__picker">
      <div className="task-move-control__journey"><span>{currentListTitle ?? 'Current list'}</span><i aria-hidden="true"><AppIcon name="arrow-right" /></i><strong>Choose a destination</strong></div>
      <label><span className="sr-only">Find a destination list</span><input ref={input} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search lists…" /></label>
      <div className="task-move-control__destinations" role="list" aria-busy={loading}>
        {destinations.map((list) => <div key={list.id} role="listitem"><button type="button" disabled={savingId !== null} onClick={() => void move(list)}><span><strong>{list.title}</strong><small>{list.taskCount} task{list.taskCount === 1 ? '' : 's'} · {list.description || 'Ready for work'}</small></span><b>{savingId === list.id ? 'Moving…' : <>Move <AppIcon name="arrow-right" /></>}</b></button></div>)}
        {loading ? <p>Finding editable lists…</p> : !error && !destinations.length ? <p>No editable active lists match that search.</p> : null}
      </div>
      {error ? <p className="task-move-control__error" role="alert">{error}</p> : null}
      <p className="task-move-control__note">The task keeps its title, notes, dates, priority, and attachments.</p>
    </div> : null}
  </section>;
}
