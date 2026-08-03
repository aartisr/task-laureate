import { useEffect, useMemo, useState } from 'react';
import type { TodoItem } from '../core/contracts/domain';
import { MAX_NOTE_LENGTH, notePreview, noteReadingMinutes, normalizeNoteForStorage } from '../core/domain/richNote';
import { RichNoteEditor, RichNoteReader } from './RichNote';

export interface TaskDetailLensProps {
  task: TodoItem;
  listTitle?: string;
  mode?: 'panel' | 'focus';
  readOnly?: boolean;
  onClose?: () => void;
  onOpenFocus?: () => void;
  onUpdate: (input: Partial<TodoItem>) => Promise<void>;
  onComplete: () => Promise<void>;
}

export function TaskDetailLens({ task, listTitle, mode = 'panel', readOnly = false, onClose, onOpenFocus, onUpdate, onComplete }: TaskDetailLensProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasNotes = Boolean(notes.trim());
  const noteMeta = useMemo(() => hasNotes ? `${noteReadingMinutes(notes)} min read · ${notes.length.toLocaleString()} characters` : '', [hasNotes, notes]);

  useEffect(() => { setTitle(task.title); setNotes(task.notes); setEditing(false); setError(null); }, [task.id, task.title, task.notes]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape' && !editing) onClose?.(); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [editing, onClose]);

  const save = async () => {
    if (!title.trim() || saving) return;
    try {
      setSaving(true); setError(null);
      await onUpdate({ title: title.trim(), notes: normalizeNoteForStorage(notes) });
      setEditing(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'We could not save this task.'); }
    finally { setSaving(false); }
  };
  const cancel = () => { setTitle(task.title); setNotes(task.notes); setEditing(false); setError(null); };
  const completed = task.status === 'done';

  return <aside className={`task-detail-lens task-detail-lens--${mode}`} aria-label={`Task details: ${task.title}`}>
    <header className="task-detail-lens__header">
      <div className="task-detail-lens__crumb">{listTitle ? `In ${listTitle}` : 'Task details'}</div>
      <div className="task-detail-lens__header-actions">
        {onOpenFocus && mode === 'panel' ? <button type="button" className="task-detail-lens__utility" onClick={onOpenFocus}>Open focus</button> : null}
        {onClose ? <button type="button" className="task-detail-lens__close" onClick={onClose} aria-label="Close task details">×</button> : null}
      </div>
    </header>
    <div className="task-detail-lens__body">
      <div className="task-detail-lens__title-row">
        <button type="button" className={`task-detail-lens__complete ${completed ? 'is-complete' : ''}`} onClick={() => void onComplete()} disabled={readOnly} aria-pressed={completed} aria-label={completed ? 'Mark task incomplete' : 'Mark task complete'}>{completed ? '✓' : ''}</button>
        {editing ? <input className="task-detail-lens__title-input" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={500} aria-label="Task title" /> : <h2>{task.title}</h2>}
      </div>
      <div className="task-detail-lens__properties">
        <span className={`priority-badge priority--${task.priority}`}>{task.priority}</span>
        {task.dueDate ? <span>Due {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span> : null}
        {task.tags.map((tag) => <span key={tag}>#{tag}</span>)}
      </div>
      <section className="task-detail-lens__note" aria-label="Task note">
        <div className="task-detail-lens__note-heading"><div><h3>Note</h3>{hasNotes ? <p>{noteMeta}</p> : null}</div>
          {!readOnly ? <button type="button" className="secondary-button" onClick={() => editing ? void save() : setEditing(true)} disabled={saving}>{editing ? (saving ? 'Saving…' : 'Save note') : hasNotes ? 'Edit' : 'Add note'}</button> : null}
        </div>
        {editing ? <RichNoteEditor value={notes} onChange={setNotes} disabled={saving} /> : hasNotes ? <RichNoteReader value={notes} /> : <p className="task-detail-lens__empty">No note yet. Keep the list concise; put the durable context here.</p>}
        {editing ? <div className="task-detail-lens__edit-actions"><button type="button" className="secondary-button" onClick={cancel} disabled={saving}>Cancel</button><span>{notes.length.toLocaleString()} / {MAX_NOTE_LENGTH.toLocaleString()}</span></div> : null}
      </section>
      {error ? <p className="task-detail-lens__error" role="alert">{error}</p> : null}
      {!editing && hasNotes ? <p className="task-detail-lens__summary" aria-label="Note preview">{notePreview(notes, 360)}</p> : null}
    </div>
  </aside>;
}
