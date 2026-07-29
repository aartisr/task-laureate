import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { appServices } from '../app/runtime/appServices';
import { dashboardQueryOptions, listTasksQueryOptions } from '../core/contracts/queryKeys';
import type { TodoItem, TodoItemStatus, Priority } from '../core/contracts/domain';
import { useTodoMutations } from '../core/mutations/useTodoMutations';
import { usePageSEO, PAGE_SEO } from '../hooks/usePageSEO';

const PRIORITY_ORDER: Priority[] = ['urgent', 'high', 'medium', 'low'];
const PRIORITY_META: Record<Priority, { label: string; cls: string; icon: string }> = {
  urgent: { label: 'Urgent', cls: 'priority--urgent', icon: '🔴' },
  high:   { label: 'High',   cls: 'priority--high',   icon: '🟠' },
  medium: { label: 'Medium', cls: 'priority--medium',  icon: '🟡' },
  low:    { label: 'Low',    cls: 'priority--low',     icon: '🟢' },
};

const STATUS_META: Record<TodoItemStatus, { label: string; cls: string; icon: string }> = {
  todo:    { label: 'To do',    cls: 'status--todo',    icon: '⬜' },
  doing:   { label: 'In progress', cls: 'status--doing', icon: '🔵' },
  done:    { label: 'Done',     cls: 'status--done',    icon: '✅' },
  blocked: { label: 'Blocked',  cls: 'status--blocked', icon: '🚫' },
  deleted: { label: 'Deleted',  cls: 'status--deleted', icon: '🗑️' },
};

function AllTasksLoader() {
  const { data: dashboard } = useQuery(dashboardQueryOptions(appServices.repository));
  const listIds = (dashboard?.lists ?? []).map((l) => l.id);

  // One query per list — each cached separately
  const listTaskQueries = listIds.map((id) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useQuery({ ...listTasksQueryOptions(appServices.repository, id), enabled: !!id })
  );

  const tasksByList: Record<string, { title: string; tasks: TodoItem[] }> = {};
  listIds.forEach((id, i) => {
    const list = dashboard!.lists.find((l) => l.id === id)!;
    tasksByList[id] = {
      title: list.title,
      tasks: (listTaskQueries[i].data ?? []).filter((t) => t.deletedAt === null),
    };
  });

  const loading = listTaskQueries.some((q) => q.isLoading);
  return { tasksByList, loading, lists: dashboard?.lists ?? [] };
}

export function TasksPage() {
  usePageSEO(PAGE_SEO.tasks);
  const { tasksByList, loading, lists } = AllTasksLoader();
  const { completeTask } = useTodoMutations();
  const [statusFilter, setStatusFilter] = useState<TodoItemStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all');
  const [groupBy, setGroupBy] = useState<'list' | 'priority' | 'status'>('list');
  const [search, setSearch] = useState('');

  const allTasks: Array<TodoItem & { listTitle: string }> = Object.entries(tasksByList).flatMap(
    ([_listId, { title, tasks }]) => tasks.map((t) => ({ ...t, listTitle: title }))
  );

  const filtered = allTasks
    .filter((t) => statusFilter === 'all' || t.status === statusFilter)
    .filter((t) => priorityFilter === 'all' || t.priority === priorityFilter)
    .filter((t) => !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.listTitle.toLowerCase().includes(search.toLowerCase()));

  // Compute groups
  type Group = { key: string; label: string; icon: string; tasks: typeof filtered };
  let groups: Group[] = [];

  if (groupBy === 'list') {
    groups = lists.map((l) => ({
      key: l.id,
      label: l.title,
      icon: '📋',
      tasks: filtered.filter((t) => t.listId === l.id),
    })).filter((g) => g.tasks.length > 0);
  } else if (groupBy === 'priority') {
    groups = PRIORITY_ORDER.map((p) => ({
      key: p,
      label: PRIORITY_META[p].label,
      icon: PRIORITY_META[p].icon,
      tasks: filtered.filter((t) => t.priority === p),
    })).filter((g) => g.tasks.length > 0);
  } else {
    const statuses: TodoItemStatus[] = ['doing', 'todo', 'blocked', 'done'];
    groups = statuses.map((s) => ({
      key: s,
      label: STATUS_META[s].label,
      icon: STATUS_META[s].icon,
      tasks: filtered.filter((t) => t.status === s),
    })).filter((g) => g.tasks.length > 0);
  }

  if (loading) return <div className="page-surface">Loading tasks…</div>;

  const todoCount = allTasks.filter((t) => t.status === 'todo').length;
  const doingCount = allTasks.filter((t) => t.status === 'doing').length;
  const blockedCount = allTasks.filter((t) => t.status === 'blocked').length;

  return (
    <section className="page-stack">
      <header className="page-hero">
        <div>
          <p className="eyebrow">All Tasks</p>
          <h1>Everything in flight</h1>
          <p className="lede">{allTasks.length} tasks across {lists.length} lists</p>
        </div>
        <div className="hero-actions">
          <Link className="secondary-button" to="/">← Dashboard</Link>
        </div>
      </header>

      {/* Summary row */}
      <div className="summary-row">
        <div className="summary-chip">
          <span className="summary-chip__value">{allTasks.length}</span>
          <span className="summary-chip__label">Total</span>
        </div>
        <div className="summary-chip summary-chip--accent">
          <span className="summary-chip__value">{doingCount}</span>
          <span className="summary-chip__label">In progress</span>
        </div>
        <div className="summary-chip">
          <span className="summary-chip__value">{todoCount}</span>
          <span className="summary-chip__label">To do</span>
        </div>
        <div className="summary-chip summary-chip--warn">
          <span className="summary-chip__value">{blockedCount}</span>
          <span className="summary-chip__label">Blocked</span>
        </div>
      </div>

      {/* Controls */}
      <div className="list-controls list-controls--wrap">
        <input
          className="list-search"
          placeholder="Search tasks…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="filter-group">
          <span className="filter-group__label">Status</span>
          {(['all', 'todo', 'doing', 'done', 'blocked'] as Array<TodoItemStatus | 'all'>).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`filter-pill ${statusFilter === s ? 'filter-pill--active' : ''}`}
            >
              {s === 'all' ? 'All' : STATUS_META[s as TodoItemStatus].label}
            </button>
          ))}
        </div>
        <div className="filter-group">
          <span className="filter-group__label">Priority</span>
          {(['all', 'urgent', 'high', 'medium', 'low'] as Array<Priority | 'all'>).map((p) => (
            <button
              key={p}
              onClick={() => setPriorityFilter(p)}
              className={`filter-pill ${priorityFilter === p ? 'filter-pill--active' : ''} ${p !== 'all' ? PRIORITY_META[p as Priority].cls : ''}`}
            >
              {p === 'all' ? 'All' : PRIORITY_META[p as Priority].label}
            </button>
          ))}
        </div>
        <div className="filter-group">
          <span className="filter-group__label">Group</span>
          {(['list', 'priority', 'status'] as const).map((g) => (
            <button
              key={g}
              onClick={() => setGroupBy(g)}
              className={`filter-pill ${groupBy === g ? 'filter-pill--active' : ''}`}
            >
              {g.charAt(0).toUpperCase() + g.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Groups */}
      {groups.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state__icon">✓</span>
          <p>No tasks match your filters.</p>
        </div>
      ) : (
        <div className="task-groups">
          {groups.map((group) => (
            <div key={group.key} className="task-group">
              <div className="task-group__header">
                <span>{group.icon}</span>
                <h3>{group.label}</h3>
                <span className="task-group__count">{group.tasks.length}</span>
              </div>
              <div className="task-group__list">
                {group.tasks
                  .sort((a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority))
                  .map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      onToggle={() =>
                        completeTask.mutate({ taskId: task.id, isComplete: task.status !== 'done' })
                      }
                    />
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function TaskRow({
  task,
  onToggle,
}: {
  task: TodoItem & { listTitle: string };
  onToggle: () => void;
}) {
  const isDone = task.status === 'done';
  const pm = PRIORITY_META[task.priority];
  const sm = STATUS_META[task.status];
  const isOverdue = task.dueDate && !isDone && new Date(task.dueDate) < new Date();

  return (
    <div className={`task-row ${isDone ? 'task-row--done' : ''} ${isOverdue ? 'task-row--overdue' : ''}`}>
      <button
        className={`task-row__check ${isDone ? 'task-row__check--done' : ''}`}
        onClick={onToggle}
        aria-label={isDone ? 'Mark incomplete' : 'Mark complete'}
      >
        {isDone ? '✓' : ''}
      </button>
      <div className="task-row__body">
        <span className="task-row__title">{task.title}</span>
        <div className="task-row__chips">
          <Link to="/lists/$listId" params={{ listId: task.listId }} className="task-row__list-link">
            📋 {task.listTitle}
          </Link>
          <span className={`priority-badge ${pm.cls}`}>{pm.icon} {pm.label}</span>
          <span className={`status-badge ${sm.cls}`}>{sm.label}</span>
          {task.dueDate && (
            <span className={`due-badge ${isOverdue ? 'due-badge--overdue' : ''}`}>
              📅 {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              {isOverdue && ' · Overdue'}
            </span>
          )}
          {task.tags.map((tag) => (
            <span key={tag} className="tag-chip">{tag}</span>
          ))}
        </div>
        {task.notes && <p className="task-row__notes">{task.notes}</p>}
      </div>
    </div>
  );
}
