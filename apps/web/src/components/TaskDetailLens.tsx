import { useEffect, useMemo, useState } from 'react';
import type { TodoItem } from '../core/contracts/domain';
import { formatDateOnly, localDate, toDateInputValue } from '../core/domain/dateOnly';
import { MAX_NOTE_LENGTH, notePreview, noteReadingMinutes, normalizeNoteForStorage } from '../core/domain/richNote';
import { RichNoteEditor, RichNoteReader } from './RichNote';
import { TaskReminderControl } from './TaskReminderControl';
import { TaskAttachments } from './TaskAttachments';
import { TaskDependencies } from './TaskDependencies';
import { TaskMoveControl } from './TaskMoveControl';
import type { TaskDependencySummary } from '../core/domain/dependencies';
import { AppIcon } from './AppIcon';
import { useWorkspaceExperience } from '../core/preferences/workspaceExperience';
import { useExperienceDisclosure } from '../hooks/useExperienceDisclosure';

export interface TaskDetailLensProps {
  task: TodoItem;
  listTitle?: string;
  mode?: 'panel' | 'inline' | 'focus';
  startEditing?: boolean;
  readOnly?: boolean;
  canManageReminders?: boolean;
  onClose?: () => void;
  onOpenFocus?: () => void;
  onUpdate: (input: Partial<TodoItem>) => Promise<void>;
  onComplete: () => Promise<void>;
  onMove?: (destinationListId: string) => Promise<void>;
}

export function TaskDetailLens({ task, listTitle, mode = 'panel', startEditing = false, readOnly = false, canManageReminders = false, onClose, onOpenFocus, onUpdate, onComplete, onMove }: TaskDetailLensProps) {
  const [editing, setEditing] = useState(startEditing && !readOnly);
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes);
  const [priority, setPriority] = useState<TodoItem['priority']>(task.priority);
  const [dueDate, setDueDate] = useState(() => toDateInputValue(task.dueDate));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dependencySummary, setDependencySummary] = useState<TaskDependencySummary | null>(null);
  const experience = useWorkspaceExperience();
  const editPropertiesRef = useExperienceDisclosure(experience);
  const moreDetailsRef = useExperienceDisclosure(experience);
  const hasNotes = Boolean(notes.trim());
  const noteMeta = useMemo(() => hasNotes ? `${noteReadingMinutes(notes)} min read · ${notes.length.toLocaleString()} characters` : '', [hasNotes, notes]);

  useEffect(() => { setTitle(task.title); setNotes(task.notes); setPriority(task.priority); setDueDate(toDateInputValue(task.dueDate)); setEditing(startEditing && !readOnly); setError(null); setDependencySummary(null); }, [task.id, task.title, task.notes, task.priority, task.dueDate, startEditing, readOnly]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape' && !editing) onClose?.(); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [editing, onClose]);

  const save = async () => {
    if (!title.trim() || saving) return;
    try {
      setSaving(true); setError(null);
      await onUpdate({ title: title.trim(), notes: normalizeNoteForStorage(notes), priority, dueDate: dueDate || null });
      setEditing(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'We could not save this task.'); }
    finally { setSaving(false); }
  };
  const saveAndClose = async () => {
    await save();
    onClose?.();
  };
  const cancel = () => { setTitle(task.title); setNotes(task.notes); setPriority(task.priority); setDueDate(toDateInputValue(task.dueDate)); setEditing(false); setError(null); };
  const changeWorkState = async (status: 'todo' | 'doing') => {
    if (saving || task.status === status) return;
    try {
      setSaving(true); setError(null);
      await onUpdate({ status });
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'We could not update the task status.'); }
    finally { setSaving(false); }
  };
  const completed = task.status === 'done';
  const completionBlocked = dependencySummary !== null && !dependencySummary.isReadyToComplete;
  const priorityOptions: Array<{ value: TodoItem['priority']; label: string; detail: string }> = [
    { value: 'low', label: 'Low', detail: 'When time allows' }, { value: 'medium', label: 'Medium', detail: 'Plan for it' },
    { value: 'high', label: 'High', detail: 'Needs attention' }, { value: 'urgent', label: 'Urgent', detail: 'Act now' },
  ];

  return <aside className={`task-detail-lens task-detail-lens--${mode}`} aria-label={`Task details: ${task.title}`}>
    <header className="task-detail-lens__header">
      <div className="task-detail-lens__context"><div className="task-detail-lens__crumb">{listTitle ? `In ${listTitle}` : 'Task details'}</div><span className={`task-detail-lens__edit-status${readOnly ? ' is-readonly' : editing ? ' is-editing' : ''}`} role="status">{readOnly ? 'Read-only' : editing ? 'Editing now' : 'Ready to edit'}</span></div>
      <div className="task-detail-lens__header-actions">
        {!readOnly && !editing ? <button type="button" className="task-detail-lens__edit-trigger" onClick={() => setEditing(true)}>Edit task</button> : null}
        {onOpenFocus && mode !== 'focus' ? <button type="button" className="task-detail-lens__utility" onClick={onOpenFocus}>Open focus</button> : null}
        {onClose ? <button type="button" className="task-detail-lens__close" onClick={onClose} aria-label="Close task details"><AppIcon name="close" /></button> : null}
      </div>
    </header>
    <div className="task-detail-lens__body">
      {editing ? <div className="task-detail-lens__edit-canvas" onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); cancel(); } else if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); void save(); } }}>
        <section className="task-detail-lens__edit-title" aria-label="Task title"><span>Task title</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={500} disabled={saving} autoFocus aria-label="Task title" /></section>
        <details ref={editPropertiesRef} className="task-detail-lens__edit-properties" aria-labelledby="task-properties-title"><summary><span>Task details</span><small>Priority, due date, and tags</small></summary><div><span>Task properties</span><h3 id="task-properties-title">Set the level of attention</h3></div><div className="task-detail-lens__priority-grid" role="radiogroup" aria-label="Task priority">{priorityOptions.map((option) => <button key={option.value} type="button" role="radio" aria-checked={priority === option.value} className={`task-detail-lens__priority-option task-detail-lens__priority-option--${option.value}${priority === option.value ? ' is-selected' : ''}`} onClick={() => setPriority(option.value)} disabled={saving}><i aria-hidden="true" /><span><strong>{option.label}</strong><small>{option.detail}</small></span></button>)} </div>
          <div className="task-detail-lens__due-date"><label htmlFor={`task-due-date-${task.id}`}><span>Due date</span><input id={`task-due-date-${task.id}`} type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} disabled={saving} /></label><div className="task-detail-lens__quick-dates" aria-label="Quick due date choices"><button type="button" onClick={() => setDueDate(localDate(0))} disabled={saving}>Today</button><button type="button" onClick={() => setDueDate(localDate(1))} disabled={saving}>Tomorrow</button>{dueDate ? <button type="button" onClick={() => setDueDate('')} disabled={saving}>Clear date</button> : null}</div></div>
          {task.tags.length ? <div className="task-detail-lens__edit-context">{task.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div> : null}
        </details>
        <section className="task-detail-lens__edit-note" aria-label="Task note"><div><span>Working context</span><h3>Notes</h3><p>Keep the details, decisions, and next steps together.</p></div><RichNoteEditor value={notes} onChange={setNotes} disabled={saving} /></section>
        <footer className="task-detail-lens__edit-actions"><div><strong>{notes.length.toLocaleString()}</strong><span> / {MAX_NOTE_LENGTH.toLocaleString()} characters</span></div><div><span className="task-detail-lens__edit-hint"><kbd>⌘↵</kbd> save · <kbd>Esc</kbd> cancel</span><button type="button" className="secondary-button" onClick={cancel} disabled={saving}>Discard</button><button type="button" className="primary-button" onClick={() => void save()} disabled={!title.trim() || saving}>{saving ? 'Saving…' : 'Save changes'}</button>{onClose ? <button type="button" className="primary-button" onClick={() => void saveAndClose()} disabled={!title.trim() || saving}>{saving ? 'Saving…' : 'Save and close'}</button> : null}</div></footer>
      </div> : <>
        <section className={`task-detail-lens__edit-guidance${readOnly ? ' is-read-only' : ''}`} aria-label={readOnly ? 'Task access' : 'Editing this task'}>
          <div><strong>{readOnly ? 'View-only access' : 'Edit this task here'}</strong><span>{readOnly ? 'You can review the details, but only an owner or editor can make changes.' : 'Use the Edit task button above to change the title, priority, or rich note without leaving this spot.'}</span></div>
        </section>
        <div className="task-detail-lens__title-row"><button type="button" className={`task-detail-lens__complete ${completed ? 'is-complete' : ''}`} onClick={() => void onComplete()} disabled={readOnly || (!completed && completionBlocked)} aria-pressed={completed} aria-label={completed ? 'Mark task incomplete' : completionBlocked ? `Cannot complete: ${dependencySummary.unresolvedPrerequisiteCount} prerequisite tasks remain` : 'Mark task complete'}>{completed ? <AppIcon name="check" /> : ''}</button><h2>{task.title}</h2></div>
        <div className="task-detail-lens__properties"><span className={`priority-badge priority--${task.priority}`}>{task.priority}</span>{task.dueDate ? <span>Due {formatDateOnly(task.dueDate, undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span> : null}{task.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>
        {!readOnly && onMove ? <TaskMoveControl task={task} currentListTitle={listTitle} onMove={onMove} /> : null}
        {!readOnly && !completed && (task.status === 'todo' || task.status === 'doing') ? <div className="task-detail-lens__work-state" role="group" aria-label="Task work state"><span>{task.status === 'doing' ? 'Work is in progress' : 'Work has not started'}</span><button type="button" className={task.status === 'doing' ? 'secondary-button' : 'primary-button'} onClick={() => void changeWorkState(task.status === 'doing' ? 'todo' : 'doing')} disabled={saving}>{saving ? 'Updating…' : task.status === 'doing' ? 'Move to to do' : 'Start work'}</button></div> : null}
        <section className="task-detail-lens__note" aria-label="Task note"><div className="task-detail-lens__note-heading"><div><h3>Note</h3>{hasNotes ? <p>{noteMeta}</p> : null}</div></div>{hasNotes ? <RichNoteReader value={notes} /> : <p className="task-detail-lens__empty">No note yet. Choose <strong>Edit task</strong> above to add durable context.</p>}</section>
      </>}
      {!editing ? <details ref={moreDetailsRef} className="task-detail-lens__more-details"><summary>More task details <span>Planning, files, and sharing</span></summary>{canManageReminders && !readOnly ? <TaskReminderControl taskId={task.id} /> : null}<TaskDependencies taskId={task.id} listId={task.listId} readOnly={readOnly} onSummaryChange={setDependencySummary} /><TaskAttachments taskId={task.id} readOnly={readOnly} /></details> : null}
      {error ? <p className="task-detail-lens__error" role="alert">{error}</p> : null}
      {!editing && hasNotes ? <p className="task-detail-lens__summary" aria-label="Note preview">{notePreview(notes, 360)}</p> : null}
    </div>
  </aside>;
}
