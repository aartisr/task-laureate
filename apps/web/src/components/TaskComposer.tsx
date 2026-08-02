import { type FormEvent, type RefObject, useState } from 'react';
import type { Priority } from '../core/contracts/domain';
import type { TodoTaskInput } from '../core/contracts/repository';

const priorities: Array<{ value: Priority; label: string; symbol: string }> = [
  { value: 'urgent', label: 'Urgent', symbol: '●' },
  { value: 'high', label: 'High', symbol: '▲' },
  { value: 'medium', label: 'Medium', symbol: '◆' },
  { value: 'low', label: 'Low', symbol: '○' },
];

function localDate(offsetDays: number) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

export function TaskComposer({
  listId,
  onCreate,
  onCancel,
  titleInputRef,
  initialInput,
  restoredDraft = false,
}: {
  listId: string;
  onCreate: (input: TodoTaskInput) => Promise<void>;
  onCancel: () => void;
  titleInputRef?: RefObject<HTMLInputElement>;
  initialInput?: Pick<TodoTaskInput, 'title' | 'priority' | 'dueDate' | 'notes'>;
  restoredDraft?: boolean;
}) {
  const [title, setTitle] = useState(initialInput?.title ?? '');
  const [priority, setPriority] = useState<Priority>(initialInput?.priority ?? 'medium');
  const [dueDate, setDueDate] = useState(initialInput?.dueDate ?? '');
  const [notes, setNotes] = useState(initialInput?.notes ?? '');
  const [showNotes, setShowNotes] = useState(Boolean(initialInput?.notes));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    setError('');
    try {
      await onCreate({ listId, title: title.trim(), priority, dueDate: dueDate || null, notes: notes.trim() || undefined });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'We could not add this task. Please try again.');
      setSaving(false);
    }
  };

  return <form className="task-composer" onSubmit={(event) => void submit(event)}>
    {restoredDraft ? <p className="task-composer__restored" role="status">Your draft was restored. Review it, then add it to your private list.</p> : null}
    <label className="task-composer__title-label" htmlFor="task-composer-title">What needs to be done?</label>
    <input
      id="task-composer-title"
      ref={titleInputRef}
      value={title}
      onChange={(event) => setTitle(event.target.value)}
      onKeyDown={(event) => { if (event.key === 'Escape') onCancel(); }}
      placeholder="e.g. Review the project brief"
      autoComplete="off"
      maxLength={500}
      required
    />
    <div className="task-composer__controls">
      <fieldset className="task-composer__priority">
        <legend>Priority</legend>
        <div role="group" aria-label="Task priority">
          {priorities.map((option) => <button
            className={`task-composer__priority-button task-composer__priority-button--${option.value}${priority === option.value ? ' is-selected' : ''}`}
            type="button"
            key={option.value}
            aria-pressed={priority === option.value}
            onClick={() => setPriority(option.value)}
          ><span aria-hidden="true">{option.symbol}</span> {option.label}</button>)}
        </div>
      </fieldset>
      <label className="task-composer__date" htmlFor="task-composer-date">Due date
        <input id="task-composer-date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
      </label>
      <div className="task-composer__quick-dates" aria-label="Quick due date choices">
        <button type="button" onClick={() => setDueDate(localDate(0))}>Today</button>
        <button type="button" onClick={() => setDueDate(localDate(1))}>Tomorrow</button>
        {dueDate ? <button type="button" onClick={() => setDueDate('')}>Clear date</button> : null}
      </div>
    </div>
    <button className="task-composer__notes-toggle" type="button" aria-expanded={showNotes} onClick={() => setShowNotes(!showNotes)}>
      {showNotes ? 'Hide notes' : 'Add notes'}
    </button>
    {showNotes ? <label className="task-composer__notes" htmlFor="task-composer-notes">Notes
      <textarea id="task-composer-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Add context, links, or the next step…" maxLength={5000} rows={3} />
    </label> : null}
    {error ? <p className="task-composer__error" role="alert">{error}</p> : null}
    <div className="task-composer__actions">
      <button className="primary-button" type="submit" disabled={!title.trim() || saving}>{saving ? 'Adding task…' : 'Add task'}</button>
      <button className="secondary-button" type="button" onClick={onCancel} disabled={saving}>Cancel</button>
    </div>
  </form>;
}
