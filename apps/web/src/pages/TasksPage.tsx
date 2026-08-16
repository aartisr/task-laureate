import { useQueries, useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useDeferredValue, useMemo, useState } from 'react';
import { appServices } from '../app/runtime/appServices';
import { dashboardQueryOptions, listTasksQueryOptions } from '../core/contracts/queryKeys';
import { supportsScalableTaskFeed } from '../core/contracts/repository';
import type { TodoItem, TodoItemStatus, Priority, TodoList } from '../core/contracts/domain';
import { formatDateOnly, isDueDateBeforeToday } from '../core/domain/dateOnly';
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

type TaskWithListTitle = TodoItem & { listTitle: string };
type TaskData = { allTasks: TaskWithListTitle[]; loading: boolean; lists: Array<Pick<TodoList, 'id' | 'title'>>; bounded: boolean };
type TaskStatusFilter = TodoItemStatus | 'all' | 'open';

function useAllTasksData(): TaskData {
  const scalableRepository = supportsScalableTaskFeed(appServices.repository) ? appServices.repository : null;
  const scalable = Boolean(scalableRepository);
  const { data: dashboard } = useQuery(dashboardQueryOptions(appServices.repository));
  const feedQuery = useQuery({ queryKey: ['tasks', 'feed', 'initial'], queryFn: () => scalableRepository ? scalableRepository.listTaskFeed({ limit: 100 }) : Promise.resolve(null), enabled: scalable, staleTime: 15_000 });
  const lists = dashboard?.lists ?? [];
  const taskQueries = useQueries({ queries: scalable ? [] : lists.map((list) => ({ ...listTasksQueryOptions(appServices.repository, list.id), enabled: true })) });
  const taskResults = taskQueries.map((query) => query.data);

  return useMemo(() => {
    if (scalable) {
      const items = feedQuery.data?.items ?? [];
      const listMap = new Map<string, Pick<TodoList, 'id' | 'title'>>();
      for (const task of items) listMap.set(task.listId, { id: task.listId, title: task.listTitle });
      return { allTasks: items, loading: feedQuery.isLoading, lists: [...listMap.values()], bounded: Boolean(feedQuery.data?.nextCursor) };
    }

    const allTasks: TaskWithListTitle[] = [];
    for (let index = 0; index < lists.length; index += 1) {
      const list = lists[index];
      for (const task of taskResults[index] ?? []) {
        if (task.deletedAt === null) allTasks.push({ ...task, listTitle: list.title });
      }
    }
    return { allTasks, loading: taskQueries.some((query) => query.isLoading), lists, bounded: false };
  // Each query result is included so this remains stable between unrelated renders.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scalable, feedQuery.data, feedQuery.isLoading, lists, ...taskResults]);
}

export function TasksPage() {
  usePageSEO(PAGE_SEO.tasks);
  const { allTasks, loading, lists, bounded } = useAllTasksData();
  const { completeTask } = useTodoMutations();
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>('open');
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all');
  const [groupBy, setGroupBy] = useState<'list' | 'priority' | 'status'>('list');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const { groups, counts } = useMemo(() => {
    type Group = { key: string; label: string; icon: string; tasks: TaskWithListTitle[] };
    const normalizedSearch = deferredSearch.trim().toLocaleLowerCase();
    const groupsByKey = new Map<string, Group>();
    const listMetadata = new Map(lists.map((list) => [list.id, { label: list.title, icon: '📋' }]));
    const priorityRank = new Map(PRIORITY_ORDER.map((priority, index) => [priority, index]));
    const counts = { todo: 0, doing: 0, blocked: 0 };

    for (const task of allTasks) {
      if (task.status === 'todo') counts.todo += 1;
      if (task.status === 'doing') counts.doing += 1;
      if (task.status === 'blocked') counts.blocked += 1;
      if (statusFilter !== 'all' && (statusFilter === 'open' ? task.status === 'done' || task.status === 'deleted' : task.status !== statusFilter)) continue;
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) continue;
      if (normalizedSearch && !task.title.toLocaleLowerCase().includes(normalizedSearch) && !task.listTitle.toLocaleLowerCase().includes(normalizedSearch)) continue;

      const key = groupBy === 'list' ? task.listId : groupBy === 'priority' ? task.priority : task.status;
      const metadata = groupBy === 'list'
        ? listMetadata.get(task.listId) ?? { label: task.listTitle, icon: '📋' }
        : groupBy === 'priority'
          ? { label: PRIORITY_META[task.priority].label, icon: PRIORITY_META[task.priority].icon }
          : { label: STATUS_META[task.status].label, icon: STATUS_META[task.status].icon };
      const group = groupsByKey.get(key) ?? { key, ...metadata, tasks: [] };
      group.tasks.push(task);
      groupsByKey.set(key, group);
    }

    const order = groupBy === 'list' ? lists.map((list) => list.id) : groupBy === 'priority' ? PRIORITY_ORDER : ['doing', 'todo', 'blocked', 'done'];
    const groups = order.flatMap((key) => {
      const group = groupsByKey.get(key);
      if (!group) return [];
      group.tasks.sort((left, right) => (priorityRank.get(left.priority) ?? 0) - (priorityRank.get(right.priority) ?? 0));
      return [group];
    });
    return { groups, counts };
  }, [allTasks, deferredSearch, groupBy, lists, priorityFilter, statusFilter]);

  if (loading) return <div className="page-surface">Loading tasks…</div>;

  const { todo: todoCount, doing: doingCount, blocked: blockedCount } = counts;

  return (
    <section className="page-stack">
      <header className="page-hero">
        <div>
          <p className="eyebrow">All Tasks</p>
          <h1>Everything in flight</h1>
          <p className="lede">{allTasks.length} tasks across {lists.length} lists{bounded ? ' · Refine your view to load the next set' : ''}</p>
        </div>
      </header>

      {/* Counts support planning, but the working view stays uncluttered by default. */}
      <details className="page-insights">
        <summary>See task totals</summary>
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
      </details>

      {/* Controls */}
      <div className="list-controls list-controls--wrap">
        <input
          className="list-search"
          aria-label="Search tasks"
          placeholder="Search tasks…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="filter-group" aria-label="Task state">
          <span className="filter-group__label">Show</span>
          {(['open', 'all', 'done'] as TaskStatusFilter[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`filter-pill ${statusFilter === s ? 'filter-pill--active' : ''}`}
            >
              {s === 'open' ? 'Open' : s === 'all' ? 'All' : STATUS_META[s as TodoItemStatus].label}
            </button>
          ))}
        </div>
        <details className="task-view-options"><summary>Refine view</summary><div className="task-view-options__body"><div className="filter-group"><span className="filter-group__label">Priority</span>{(['all', 'urgent', 'high', 'medium', 'low'] as Array<Priority | 'all'>).map((p) => <button key={p} type="button" onClick={() => setPriorityFilter(p)} className={`filter-pill ${priorityFilter === p ? 'filter-pill--active' : ''} ${p !== 'all' ? PRIORITY_META[p as Priority].cls : ''}`}>{p === 'all' ? 'All' : PRIORITY_META[p as Priority].label}</button>)}</div><div className="filter-group"><span className="filter-group__label">Group</span>{(['list', 'priority', 'status'] as const).map((g) => <button key={g} type="button" onClick={() => setGroupBy(g)} className={`filter-pill ${groupBy === g ? 'filter-pill--active' : ''}`}>{g.charAt(0).toUpperCase() + g.slice(1)}</button>)}</div>{(priorityFilter !== 'all' || groupBy !== 'list' || search) ? <button type="button" className="secondary-button" onClick={() => { setPriorityFilter('all'); setGroupBy('list'); setSearch(''); }}>Reset refinements</button> : null}</div></details>
      </div>

      {/* Groups */}
      {groups.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state__icon">✓</span>
          <p>No tasks match this view.</p>
          {(statusFilter !== 'open' || priorityFilter !== 'all' || search || groupBy !== 'list') ? <button type="button" className="secondary-button" onClick={() => { setStatusFilter('open'); setPriorityFilter('all'); setGroupBy('list'); setSearch(''); }}>Show open tasks</button> : null}
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
                {group.tasks.map((task) => (
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
  const isOverdue = Boolean(task.dueDate && !isDone && isDueDateBeforeToday(task.dueDate));

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
              📅 {formatDateOnly(task.dueDate, 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
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
