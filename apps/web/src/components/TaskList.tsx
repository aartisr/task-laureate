import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { announceToScreenReader, createId } from '../lib/a11y';
import type { TodoItem } from '../core/contracts/domain';
import { TaskItem } from './TaskItem';
import { TaskDetailLens } from './TaskDetailLens';
import { DraggableItem } from './DraggableItem';
import { useDragDrop } from '../hooks/useDragDrop';
import './TaskList.css';

export interface TaskListProps {
  listId: string;
  tasks: TodoItem[];
  isLoading?: boolean;
  onTaskUpdate: (id: string, data: Partial<TodoItem>) => Promise<void>;
  onTaskComplete: (id: string) => Promise<void>;
  onTaskDelete: (id: string) => Promise<void>;
  onTaskRestore: (id: string) => Promise<void>;
  /** Archived lists retain their history but must not look editable. */
  readOnly?: boolean;
  /** Explains why controls are unavailable without coupling this component to access policy. */
  readOnlyMessage?: string;
}

type SortOption = 'focus' | 'priority' | 'dueDate' | 'createdAt' | 'alphabetical';
type FilterOption = 'all' | 'active' | 'completed';
type TaskGroup = 'Overdue' | 'Due today' | 'Upcoming' | 'No due date' | 'Completed';

const priorityOrder: Record<TodoItem['priority'], number> = { urgent: 0, high: 1, medium: 2, low: 3 };

function dateKey(value: string | null) {
  return value ? value.slice(0, 10) : null;
}

function todayKey() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function groupForTask(task: TodoItem, today: string): TaskGroup {
  if (task.completedAt) return 'Completed';
  const due = dateKey(task.dueDate);
  if (!due) return 'No due date';
  if (due < today) return 'Overdue';
  if (due === today) return 'Due today';
  return 'Upcoming';
}

const groupOrder: TaskGroup[] = ['Overdue', 'Due today', 'Upcoming', 'No due date', 'Completed'];

export function TaskList({ listId, tasks, isLoading, onTaskUpdate, onTaskComplete, onTaskDelete, onTaskRestore, readOnly = false, readOnlyMessage = 'Restore the list to edit or add work.' }: TaskListProps) {
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState<SortOption>('focus');
  const [filterBy, setFilterBy] = useState<FilterOption>('active');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const regionId = useRef(createId('tasklist-region')).current;
  const today = todayKey();

  const { draggedIndex, dragOverIndex, handleDragStart, handleDragOver, handleDragEnd, handleDragLeave } = useDragDrop(tasks, {
    onReorder: () => announceToScreenReader('Tasks reordered'),
  });

  const stats = useMemo(() => {
    const completed = tasks.filter((task) => task.completedAt !== null).length;
    const overdue = tasks.filter((task) => groupForTask(task, today) === 'Overdue').length;
    return { total: tasks.length, completed, active: tasks.length - completed, overdue };
  }, [tasks, today]);

  const visibleTasks = useMemo(() => tasks
    .filter((task) => filterBy === 'all' || (filterBy === 'active' ? !task.completedAt : Boolean(task.completedAt)))
    .sort((a, b) => {
      if (sortBy === 'alphabetical') return a.title.localeCompare(b.title);
      if (sortBy === 'createdAt') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === 'priority') return priorityOrder[a.priority] - priorityOrder[b.priority];
      if (sortBy === 'dueDate') return (dateKey(a.dueDate) ?? '9999-12-31').localeCompare(dateKey(b.dueDate) ?? '9999-12-31');
      const groupDifference = groupOrder.indexOf(groupForTask(a, today)) - groupOrder.indexOf(groupForTask(b, today));
      if (groupDifference !== 0) return groupDifference;
      return priorityOrder[a.priority] - priorityOrder[b.priority] || (dateKey(a.dueDate) ?? '9999-12-31').localeCompare(dateKey(b.dueDate) ?? '9999-12-31');
    }), [tasks, filterBy, sortBy, today]);

  const groups = useMemo(() => {
    if (sortBy !== 'focus') return [{ name: null, tasks: visibleTasks }];
    return groupOrder.map((name) => ({ name, tasks: visibleTasks.filter((task) => groupForTask(task, today) === name) })).filter((group) => group.tasks.length > 0);
  }, [sortBy, visibleTasks, today]);

  const selectTask = useCallback((taskId: string) => setSelectedId((current) => current === taskId ? null : taskId), []);
  const selectedTask = tasks.find((task) => task.id === selectedId) ?? null;
  const completionPercent = stats.total ? Math.round((stats.completed / stats.total) * 100) : 0;

  if (isLoading) return <section className="task-list task-list--loading" aria-busy="true" aria-live="polite"><p>Loading tasks…</p></section>;

  if (readOnly) return <section id={regionId} className="task-list task-list--readonly" aria-label="Read-only tasks">
    <header className="task-list__header"><div><p className="task-list__eyebrow">Read-only</p><h2>Tasks</h2><p>{readOnlyMessage}</p></div><div className="task-list__progress"><span>{completionPercent}% complete</span><div role="progressbar" aria-valuenow={completionPercent} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${completionPercent}%` }} /></div></div></header>
    <div role="list" className="task-list__items">{tasks.map((task) => <article key={task.id} role="listitem" className={`task-item ${task.completedAt ? 'task-item--completed' : ''}`}><div className="task-item__row"><span aria-hidden="true" className="task-item__readonly-check">{task.completedAt ? '✓' : '○'}</span><div className="task-item__content"><p className="task-item__title">{task.title}</p>{task.notes && <p className="task-item__meta">{task.notes}</p>}</div></div></article>)}</div>
  </section>;

  return <section id={regionId} className="task-list" aria-label="Tasks">
    <header className="task-list__header">
      <div><p className="task-list__eyebrow">Your list</p><h2>Tasks</h2><p>{stats.active === 1 ? '1 task remains' : `${stats.active} tasks remain`}{stats.overdue ? ` · ${stats.overdue} overdue` : ''}</p></div>
      <div className="task-list__progress" aria-label={`${completionPercent}% complete`}>
        <span>{completionPercent}% complete</span><div role="progressbar" aria-valuenow={completionPercent} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${completionPercent}%` }} /></div>
      </div>
    </header>

    <div className="task-list__toolbar">
      <div className="task-list__filters" role="group" aria-label="Filter tasks">
        {([['active', 'Open', stats.active], ['all', 'All', stats.total], ['completed', 'Done', stats.completed]] as const).map(([value, label, count]) => <button key={value} type="button" aria-pressed={filterBy === value} className={filterBy === value ? 'is-active' : ''} onClick={() => { setFilterBy(value); announceToScreenReader(`Showing ${label.toLowerCase()} tasks`); }}>{label} <span>{count}</span></button>)}
      </div>
      <label className="task-list__sort" htmlFor="task-list-sort">Order
        <select id="task-list-sort" value={sortBy} onChange={(event) => { setSortBy(event.target.value as SortOption); announceToScreenReader(`Tasks ordered by ${event.target.selectedOptions[0].text}`); }}>
          <option value="focus">What needs attention</option><option value="priority">Priority</option><option value="dueDate">Due date</option><option value="createdAt">Recently added</option><option value="alphabetical">Name A–Z</option>
        </select>
      </label>
    </div>

    <div className="task-lens-layout">
    {groups.length ? <div className="task-list__groups">{groups.map((group) => <section className="task-list__group" key={group.name ?? 'all'} aria-label={group.name ?? 'Tasks'}>
      {group.name ? <h3 className={`task-list__group-title task-list__group-title--${group.name.toLowerCase().replaceAll(' ', '-')}`}>{group.name}<span>{group.tasks.length}</span></h3> : null}
      <div role="list" className="task-list__items">{group.tasks.map((task) => {
        const sourceIndex = tasks.findIndex((candidate) => candidate.id === task.id);
        return <DraggableItem key={task.id} index={sourceIndex} isDragging={draggedIndex === sourceIndex} isDragOver={dragOverIndex === sourceIndex} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd} onDragLeave={handleDragLeave} className="move-handle"><div role="listitem"><TaskItem task={task} selected={selectedId === task.id} onOpen={() => selectTask(task.id)} onComplete={() => onTaskComplete(task.id)} onDelete={() => onTaskDelete(task.id)} onRestore={() => onTaskRestore(task.id)} /></div></DraggableItem>;
      })}</div>
    </section>)}</div> : <div className="task-list__empty" role="status"><span aria-hidden="true">✦</span><h3>{filterBy === 'active' ? 'Nothing is waiting' : filterBy === 'completed' ? 'No completed tasks yet' : 'No tasks yet'}</h3><p>{filterBy === 'active' ? 'Enjoy the clear runway, or add the next task above.' : 'Try another view or add a task above.'}</p></div>}
    {selectedTask ? <TaskDetailLens task={selectedTask} onClose={() => setSelectedId(null)} onOpenFocus={() => navigate({ to: '/lists/$listId/tasks/$taskId', params: { listId, taskId: selectedTask.id } })} onUpdate={(input) => onTaskUpdate(selectedTask.id, input)} onComplete={() => onTaskComplete(selectedTask.id)} /> : null}
    </div>
  </section>;
}
