import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { announceToScreenReader, createId } from '../lib/a11y';
import type { TodoItem } from '../core/contracts/domain';
import { TaskItem } from './TaskItem';
import { TaskDetailLens } from './TaskDetailLens';
import { DraggableItem } from './DraggableItem';
import { useDragDrop } from '../hooks/useDragDrop';
import { VirtualTaskItems } from './VirtualTaskItems';
import { getDueDateState, localDate, toDateInputValue } from '../core/domain/dateOnly';
import './TaskList.css';
import { appServices } from '../app/runtime/appServices';
import { supportsDependencies } from '../core/contracts/repository';
import type { TaskDependencySummary } from '../core/domain/dependencies';

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
  canManageReminders?: boolean;
}

type SortOption = 'focus' | 'priority' | 'dueDate' | 'createdAt' | 'alphabetical';
type FilterOption = 'all' | 'active' | 'completed' | 'blocked';
type TaskGroup = 'Overdue' | 'Due today' | 'Upcoming' | 'No due date' | 'Completed';
type PersonalView = { id: string; name: string; filterBy: FilterOption; sortBy: SortOption };
const personalViewsKey = 'task-laureate.personal-task-views.v1';

function loadPersonalViews(): PersonalView[] {
  try { const value = JSON.parse(localStorage.getItem(personalViewsKey) ?? '[]'); return Array.isArray(value) ? value.filter((item): item is PersonalView => typeof item?.id === 'string' && typeof item?.name === 'string') : []; } catch { return []; }
}

const priorityOrder: Record<TodoItem['priority'], number> = { urgent: 0, high: 1, medium: 2, low: 3 };

function dateKey(value: string | null) {
  return toDateInputValue(value) || null;
}

function todayKey() {
  return localDate();
}

function groupForTask(task: TodoItem, today: string): TaskGroup {
  if (task.completedAt) return 'Completed';
  switch (getDueDateState(task.dueDate, new Date(`${today}T12:00:00`))) {
    case 'overdue': return 'Overdue';
    case 'today': return 'Due today';
    case 'upcoming': return 'Upcoming';
    case 'none': return 'No due date';
  }
}

const groupOrder: TaskGroup[] = ['Overdue', 'Due today', 'Upcoming', 'No due date', 'Completed'];

export function TaskList({ listId, tasks, isLoading, onTaskUpdate, onTaskComplete, onTaskDelete, onTaskRestore, readOnly = false, readOnlyMessage = 'Restore the list to edit or add work.', canManageReminders = false }: TaskListProps) {
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState<SortOption>('focus');
  const [filterBy, setFilterBy] = useState<FilterOption>('active');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [personalViews, setPersonalViews] = useState<PersonalView[]>(loadPersonalViews);
  const [dependencySummaries, setDependencySummaries] = useState<Record<string, TaskDependencySummary>>({});
  const regionId = useRef(createId('tasklist-region')).current;
  const today = todayKey();
  const dependencyRepository = supportsDependencies(appServices.repository) ? appServices.repository : null;
  const taskIdKey = useMemo(() => tasks.filter((task) => task.deletedAt === null).map((task) => task.id).sort().join(','), [tasks]);
  useEffect(() => {
    let active = true;
    if (!dependencyRepository) { setDependencySummaries({}); return () => { active = false; }; }
    void dependencyRepository.getDependencySummaries(taskIdKey ? taskIdKey.split(',') : []).then((summaries) => { if (active) setDependencySummaries(summaries); }).catch(() => { if (active) setDependencySummaries({}); });
    return () => { active = false; };
  }, [dependencyRepository, taskIdKey]);

  const { draggedIndex, dragOverIndex, handleDragStart, handleDragOver, handleDragEnd, handleDragLeave } = useDragDrop(tasks, {
    onReorder: () => announceToScreenReader('Tasks reordered'),
  });

  const stats = useMemo(() => {
    const completed = tasks.filter((task) => task.completedAt !== null).length;
    const overdue = tasks.filter((task) => groupForTask(task, today) === 'Overdue').length;
    const inProgress = tasks.filter((task) => task.status === 'doing').length;
    return { total: tasks.length, completed, active: tasks.length - completed, overdue, inProgress };
  }, [tasks, today]);

  const visibleTasks = useMemo(() => tasks
    .filter((task) => filterBy === 'all' || (filterBy === 'active' ? !task.completedAt : filterBy === 'completed' ? Boolean(task.completedAt) : (dependencySummaries[task.id]?.unresolvedPrerequisiteCount ?? 0) > 0))
    .sort((a, b) => {
      if (sortBy === 'alphabetical') return a.title.localeCompare(b.title);
      if (sortBy === 'createdAt') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === 'priority') return priorityOrder[a.priority] - priorityOrder[b.priority];
      if (sortBy === 'dueDate') return (dateKey(a.dueDate) ?? '9999-12-31').localeCompare(dateKey(b.dueDate) ?? '9999-12-31');
      const groupDifference = groupOrder.indexOf(groupForTask(a, today)) - groupOrder.indexOf(groupForTask(b, today));
      if (groupDifference !== 0) return groupDifference;
      return priorityOrder[a.priority] - priorityOrder[b.priority] || (dateKey(a.dueDate) ?? '9999-12-31').localeCompare(dateKey(b.dueDate) ?? '9999-12-31');
    }), [tasks, filterBy, sortBy, today, dependencySummaries]);

  const groups = useMemo(() => {
    if (sortBy !== 'focus') return [{ name: null, tasks: visibleTasks }];
    return groupOrder.map((name) => ({ name, tasks: visibleTasks.filter((task) => groupForTask(task, today) === name) })).filter((group) => group.tasks.length > 0);
  }, [sortBy, visibleTasks, today]);

  const selectTask = useCallback((taskId: string) => setSelectedId((current) => current === taskId ? null : taskId), []);
  const savePersonalView = () => {
    const name = window.prompt('Name this personal view');
    if (!name?.trim()) return;
    const next = [...personalViews, { id: crypto.randomUUID(), name: name.trim().slice(0, 60), filterBy, sortBy }];
    setPersonalViews(next); localStorage.setItem(personalViewsKey, JSON.stringify(next));
    announceToScreenReader(`Saved personal view ${name.trim()}`);
  };
  const completionPercent = stats.total ? Math.round((stats.completed / stats.total) * 100) : 0;
  const renderInlineDetail = (task: TodoItem) => <TaskDetailLens mode="inline" task={task} canManageReminders={canManageReminders} onClose={() => setSelectedId(null)} onOpenFocus={() => navigate({ to: '/lists/$listId/tasks/$taskId', params: { listId, taskId: task.id } })} onUpdate={(input) => onTaskUpdate(task.id, input)} onComplete={() => onTaskComplete(task.id)} />;

  if (isLoading) return <section className="task-list task-list--loading" aria-busy="true" aria-live="polite"><p>Loading tasks…</p></section>;

  if (readOnly) return <section id={regionId} className="task-list task-list--readonly" aria-label="Read-only tasks">
    <header className="task-list__header"><div><p className="task-list__eyebrow">Read-only</p><h2>Tasks</h2><p>{readOnlyMessage}</p></div><div className="task-list__progress"><span>{completionPercent}% complete</span><div role="progressbar" aria-valuenow={completionPercent} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${completionPercent}%` }} /></div></div></header>
    <div role="list" className="task-list__items">{tasks.map((task) => <article key={task.id} role="listitem" className={`task-item ${task.completedAt ? 'task-item--completed' : ''}`}><div className="task-item__row"><span aria-hidden="true" className="task-item__readonly-check">{task.completedAt ? '✓' : '○'}</span><div className="task-item__content"><p className="task-item__title">{task.title}</p>{task.notes && <p className="task-item__meta">{task.notes}</p>}</div></div></article>)}</div>
  </section>;

  return <section id={regionId} className="task-list" aria-label="Tasks">
    <header className="task-list__header">
      <div><p className="task-list__eyebrow">Your list</p><h2>Tasks</h2><p>{stats.active === 1 ? '1 task remains' : `${stats.active} tasks remain`}{stats.inProgress ? ` · ${stats.inProgress} in progress` : ''}{stats.overdue ? ` · ${stats.overdue} overdue` : ''}</p></div>
      <div className="task-list__progress" aria-label={`${completionPercent}% complete`}>
        <span>{completionPercent}% complete</span><div role="progressbar" aria-valuenow={completionPercent} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${completionPercent}%` }} /></div>
      </div>
    </header>

    <div className="task-list__toolbar">
      <div className="task-list__filters" role="group" aria-label="Filter tasks">
        {([['active', 'Open', stats.active], ['blocked', 'Blocked', tasks.filter((task) => (dependencySummaries[task.id]?.unresolvedPrerequisiteCount ?? 0) > 0).length], ['all', 'All', stats.total], ['completed', 'Done', stats.completed]] as const).map(([value, label, count]) => <button key={value} type="button" aria-pressed={filterBy === value} className={filterBy === value ? 'is-active' : ''} onClick={() => { setFilterBy(value); announceToScreenReader(`Showing ${label.toLowerCase()} tasks`); }}>{label} <span>{count}</span></button>)}
      </div>
      <details className="task-list__view-options"><summary>View options</summary><div><label className="task-list__sort" htmlFor="task-list-sort">Order<select id="task-list-sort" value={sortBy} onChange={(event) => { setSortBy(event.target.value as SortOption); announceToScreenReader(`Tasks ordered by ${event.target.selectedOptions[0].text}`); }}><option value="focus">What needs attention</option><option value="priority">Priority</option><option value="dueDate">Due date</option><option value="createdAt">Recently added</option><option value="alphabetical">Name A–Z</option></select></label><div className="task-list__views"><select aria-label="Open a saved personal view" defaultValue="" onChange={(event) => { const view = personalViews.find((item) => item.id === event.target.value); if (view) { setFilterBy(view.filterBy); setSortBy(view.sortBy); announceToScreenReader(`Opened ${view.name}`); } event.currentTarget.value = ''; }}><option value="">Personal views</option>{personalViews.map((view) => <option key={view.id} value={view.id}>{view.name}</option>)}</select><button type="button" onClick={savePersonalView}>Save view</button></div></div></details>
    </div>

    {groups.length ? <div className="task-list__groups">{groups.map((group) => <section className="task-list__group" key={group.name ?? 'all'} aria-label={group.name ?? 'Tasks'}>
      {group.name ? <h3 className={`task-list__group-title task-list__group-title--${group.name.toLowerCase().replaceAll(' ', '-')}`}>{group.name}<span>{group.tasks.length}</span></h3> : null}
      {(sortBy !== 'focus' && group.tasks.length > 120) ? <VirtualTaskItems tasks={group.tasks} selectedId={selectedId} renderDetail={renderInlineDetail} render={(task) => <TaskItem task={task} selected={selectedId === task.id} dependencySummary={dependencySummaries[task.id]} onOpen={() => selectTask(task.id)} onComplete={() => onTaskComplete(task.id)} onDelete={() => onTaskDelete(task.id)} onRestore={() => onTaskRestore(task.id)} onStart={() => onTaskUpdate(task.id, { status: 'doing' })} />} /> : <div role="list" className="task-list__items">{group.tasks.map((task) => {
        const sourceIndex = tasks.findIndex((candidate) => candidate.id === task.id);
        return <Fragment key={task.id}><DraggableItem index={sourceIndex} isDragging={draggedIndex === sourceIndex} isDragOver={dragOverIndex === sourceIndex} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd} onDragLeave={handleDragLeave} className="move-handle"><div role="listitem"><TaskItem task={task} selected={selectedId === task.id} dependencySummary={dependencySummaries[task.id]} onOpen={() => selectTask(task.id)} onComplete={() => onTaskComplete(task.id)} onDelete={() => onTaskDelete(task.id)} onRestore={() => onTaskRestore(task.id)} onStart={() => onTaskUpdate(task.id, { status: 'doing' })} /></div></DraggableItem>{selectedId === task.id ? <div className="task-list__inline-detail">{renderInlineDetail(task)}</div> : null}</Fragment>;
      })}</div>}
    </section>)}</div> : <div className="task-list__empty" role="status"><span aria-hidden="true">✦</span><h3>{filterBy === 'active' ? 'Nothing is waiting' : filterBy === 'completed' ? 'No completed tasks yet' : 'No tasks yet'}</h3><p>{filterBy === 'active' ? 'Enjoy the clear runway, or add the next task above.' : 'Try another view or add a task above.'}</p></div>}
  </section>;
}
