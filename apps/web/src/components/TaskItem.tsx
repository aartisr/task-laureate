import { notePreview, noteReadingMinutes } from '../core/domain/richNote';
import type { TodoItem } from '../core/contracts/domain';

export interface TaskItemProps {
  task: TodoItem;
  selected?: boolean;
  onOpen: () => void;
  onComplete: () => Promise<void>;
  onDelete: () => Promise<void>;
  onRestore: () => Promise<void>;
}

export function TaskItem({ task, selected = false, onOpen, onComplete, onDelete, onRestore }: TaskItemProps) {
  const completed = task.status === 'done';
  const deleted = task.deletedAt !== null;
  if (deleted) return <article className="task-item task-item--deleted"><div className="task-item__row"><div className="task-item__content"><p className="task-item__title">{task.title}</p><p className="task-item__deleted-label">Deleted</p></div><button onClick={() => void onRestore()} className="secondary-button">Restore</button></div></article>;
  const preview = notePreview(task.notes, 190);
  return <article className={`task-item ${selected ? 'task-item--selected' : ''} ${completed ? 'task-item--completed' : ''}`} aria-label={`Task: ${task.title}`}>
    <div className="task-item__row">
      <button onClick={() => void onComplete()} aria-checked={completed} aria-label={`Mark task ${completed ? 'incomplete' : 'complete'}: ${task.title}`} role="checkbox" className={`task-item__complete ${completed ? 'is-completed' : ''}`}>{completed ? '✓' : ''}</button>
      <button type="button" onClick={onOpen} className="task-item__open" aria-expanded={selected}>
        <span className="task-item__title-line"><span className="task-item__title">{task.title}</span><span className="task-item__edit-cta">Open &amp; edit <span aria-hidden="true">→</span></span></span>
        {preview ? <span className="task-item__notes">{preview}</span> : null}
        {task.notes ? <span className="task-item__note-meta">Note · {noteReadingMinutes(task.notes)} min read</span> : null}
      </button>
      <span className={`task-item__priority priority--${task.priority}`}>{task.priority}</span>
      <button onClick={() => void onDelete()} className="task-item__icon-button task-item__icon-button--danger" aria-label={`Delete task: ${task.title}`}>🗑️</button>
    </div>
    <div className="task-item__footer"><div className="task-item__dates">{task.dueDate ? <span className="task-item__due">Due {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span> : null}</div>{task.tags.length ? <div className="task-item__tags">{task.tags.map((tag) => <span key={tag} className="task-item__tag">#{tag}</span>)}</div> : null}</div>
  </article>;
}
