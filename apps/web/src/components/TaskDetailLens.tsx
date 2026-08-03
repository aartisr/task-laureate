import { useEffect, useMemo, useState } from 'react';
import type { TodoItem } from '../core/contracts/domain';
import { MAX_NOTE_LENGTH, notePreview, noteReadingMinutes, normalizeNoteForStorage } from '../core/domain/richNote';
import { RichNoteEditor, RichNoteReader } from './RichNote';
import { TaskReminderControl } from './TaskReminderControl';

export interface TaskDetailLensProps {
  task: TodoItem;
  listTitle?: string;
  mode?: 'panel' | 'focus';
  readOnly?: boolean;
  canManageReminders?: boolean;
  onClose?: () => void;
  onOpenFocus?: () => void;
  onUpdate: (input: Partial<TodoItem>) => Promise<void>;
  onComplete: () => Promise<void>;
}

export function TaskDetailLens({ task, listTitle, mode = 'panel', readOnly = false, canManageReminders = false, onClose, onOpenFocus, onUpdate, onComplete }: TaskDetailLensProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes);
  const [priority, setPriority] = useState<TodoItem['priority']>(task.priority);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasNotes = Boolean(notes.trim());
  const noteMeta = useMemo(() => hasNotes ? `${noteReadingMinutes(notes)} min read · ${notes.length.toLocaleString()} characters` : '', [hasNotes, notes]);

  useEffect(() => { setTitle(task.title); setNotes(task.notes); setPriority(task.priority); setEditing(false); setError(null); }, [task.id, task.title, task.notes, task.priority]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape' && !editing) onClose?.(); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [editing, onClose]);

  const save = async () => {
    if (!title.trim() || saving) return;
    try {
      setSaving(true); setError(null);
      await onUpdate({ title: title.trim(), notes: normalizeNoteForStorage(notes), priority });
      setEditing(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'We could not save this task.'); }
    finally { setSaving(false); }
  };
  const cancel = () => { setTitle(task.title); setNotes(task.notes); setPriority(task.priority); setEditing(false); setError(null); };
  const completed = task.status === 'done';
  const priorityOptions: Array<{ value: TodoItem['priority']; label: string; detail: string }> = [
    { value: 'low', label: 'Low', detail: 'When time allows' }, { value: 'medium', label: 'Medium', detail: 'Plan for it' },
    { value: 'high', label: 'High', detail: 'Needs attention' }, { value: 'urgent', label: 'Urgent', detail: 'Act now' },
  ];

  return <aside className={`task-detail-lens task-detail-lens--${mode}`} aria-label={`Task details: ${task.title}`}>
    <header className="task-detail-lens__header">
      <div className="task-detail-lens__crumb">{listTitle ? `In ${listTitle}` : 'Task details'}</div>
      <div className="task-detail-lens__header-actions">
        {onOpenFocus && mode === 'panel' ? <button type="button" className="task-detail-lens__utility" onClick={onOpenFocus}>Open focus</button> : null}
        {onClose ? <button type="button" className="task-detail-lens__close" onClick={onClose} aria-label="Close task details">×</button> : null}
      </div>
    </header>
    <div className="task-detail-lens__body">
      {editing ? <div className="task-detail-lens__edit-canvas">
        <section className="task-detail-lens__edit-title" aria-label="Task title"><span>Task title</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={500} disabled={saving} autoFocus aria-label="Task title" /></section>
        <section className="task-detail-lens__edit-properties" aria-labelledby="task-properties-title"><div><span>Task properties</span><h3 id="task-properties-title">Set the level of attention</h3></div><div className="task-detail-lens__priority-grid" role="radiogroup" aria-label="Task priority">{priorityOptions.map((option) => <button key={option.value} type="button" role="radio" aria-checked={priority === option.value} className={`task-detail-lens__priority-option task-detail-lens__priority-option--${option.value}${priority === option.value ? ' is-selected' : ''}`} onClick={() => setPriority(option.value)} disabled={saving}><i aria-hidden="true" /><span><strong>{option.label}</strong><small>{option.detail}</small></span></button>)}</div>
          {(task.dueDate || task.tags.length) ? <div className="task-detail-lens__edit-context">{task.dueDate ? <span>Due {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span> : null}{task.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div> : null}
        </section>
        <section className="task-detail-lens__edit-note" aria-label="Task note"><div><span>Working context</span><h3>Notes</h3><p>Keep the details, decisions, and next steps together.</p></div><RichNoteEditor value={notes} onChange={setNotes} disabled={saving} /></section>
        <footer className="task-detail-lens__edit-actions"><div><strong>{notes.length.toLocaleString()}</strong><span> / {MAX_NOTE_LENGTH.toLocaleString()} characters</span></div><div><button type="button" className="secondary-button" onClick={cancel} disabled={saving}>Discard</button><button type="button" className="primary-button" onClick={() => void save()} disabled={!title.trim() || saving}>{saving ? 'Saving…' : 'Save changes'}</button></div></footer>
      </div> : <>
        <div className="task-detail-lens__title-row"><button type="button" className={`task-detail-lens__complete ${completed ? 'is-complete' : ''}`} onClick={() => void onComplete()} disabled={readOnly} aria-pressed={completed} aria-label={completed ? 'Mark task incomplete' : 'Mark task complete'}>{completed ? '✓' : ''}</button><h2>{task.title}</h2></div>
        <div className="task-detail-lens__properties"><span className={`priority-badge priority--${task.priority}`}>{task.priority}</span>{task.dueDate ? <span>Due {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span> : null}{task.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>
        <section className="task-detail-lens__note" aria-label="Task note"><div className="task-detail-lens__note-heading"><div><h3>Note</h3>{hasNotes ? <p>{noteMeta}</p> : null}</div>{!readOnly ? <button type="button" className="secondary-button" onClick={() => setEditing(true)}>Edit task</button> : null}</div>{hasNotes ? <RichNoteReader value={notes} /> : <p className="task-detail-lens__empty">No note yet. Keep the list concise; put the durable context here.</p>}</section>
      </>}
      {canManageReminders && !readOnly ? <TaskReminderControl taskId={task.id} /> : null}
      {error ? <p className="task-detail-lens__error" role="alert">{error}</p> : null}
      {!editing && hasNotes ? <p className="task-detail-lens__summary" aria-label="Note preview">{notePreview(notes, 360)}</p> : null}
    </div>
  </aside>;
}
