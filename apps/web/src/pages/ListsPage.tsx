import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { appServices } from '../app/runtime/appServices';
import { dashboardQueryOptions } from '../core/contracts/queryKeys';
import type { TodoList, TodoListStatus } from '../core/contracts/domain';
import { usePageSEO, PAGE_SEO } from '../hooks/usePageSEO';

type SortKey = 'title' | 'progress' | 'tasks' | 'created';
type FilterStatus = 'all' | TodoListStatus;

function ProgressRing({ percent, size = 40 }: { percent: number; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const fill = (percent / 100) * circ;
  return (
    <svg width={size} height={size} className="progress-ring" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} className="progress-ring__track" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        className="progress-ring__fill"
        strokeDasharray={`${fill} ${circ}`}
        strokeDashoffset={circ / 4}
        style={{ '--pct': percent } as React.CSSProperties}
      />
      <text x="50%" y="54%" textAnchor="middle" className="progress-ring__label">
        {percent}%
      </text>
    </svg>
  );
}

function StatusBadge({ status }: { status: TodoListStatus }) {
  const map: Record<TodoListStatus, { label: string; cls: string }> = {
    active: { label: 'Active', cls: 'badge--active' },
    archived: { label: 'Archived', cls: 'badge--archived' },
    deleted: { label: 'Deleted', cls: 'badge--deleted' },
  };
  const { label, cls } = map[status];
  return <span className={`status-badge ${cls}`}>{label}</span>;
}

export function ListsPage() {
  usePageSEO(PAGE_SEO.listsOverview);
  const { data } = useQuery(dashboardQueryOptions(appServices.repository));
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [sort, setSort] = useState<SortKey>('created');
  const [search, setSearch] = useState('');

  const lists = (data?.lists ?? [])
    .filter((l) => filter === 'all' || l.status === filter)
    .filter((l) => !search || l.title.toLowerCase().includes(search.toLowerCase()))
    .slice()
    .sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title);
      if (sort === 'progress') return b.completionPercent - a.completionPercent;
      if (sort === 'tasks') return b.taskCount - a.taskCount;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const totalTasks = lists.reduce((s, l) => s + l.taskCount, 0);
  const avgProgress =
    lists.length > 0
      ? Math.round(lists.reduce((s, l) => s + l.completionPercent, 0) / lists.length)
      : 0;
  const doneCount = lists.filter((l) => l.completionPercent === 100).length;

  return (
    <section className="page-stack">
      <header className="page-hero">
        <div>
          <p className="eyebrow">Overview</p>
          <h1>All Lists</h1>
          <p className="lede">
            {lists.length} list{lists.length !== 1 ? 's' : ''} · {totalTasks} tasks total · {avgProgress}% avg progress
          </p>
        </div>
        <div className="hero-actions">
          <Link className="secondary-button" to="/">← Dashboard</Link>
        </div>
      </header>

      {/* Summary bar */}
      <div className="summary-row">
        <div className="summary-chip">
          <span className="summary-chip__value">{lists.length}</span>
          <span className="summary-chip__label">Total lists</span>
        </div>
        <div className="summary-chip">
          <span className="summary-chip__value">{totalTasks}</span>
          <span className="summary-chip__label">Total tasks</span>
        </div>
        <div className="summary-chip summary-chip--success">
          <span className="summary-chip__value">{doneCount}</span>
          <span className="summary-chip__label">Fully done</span>
        </div>
        <div className="summary-chip summary-chip--accent">
          <span className="summary-chip__value">{avgProgress}%</span>
          <span className="summary-chip__label">Avg progress</span>
        </div>
      </div>

      {/* Controls */}
      <div className="list-controls">
        <input
          className="list-search"
          placeholder="Filter lists…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="filter-group">
          {(['all', 'active', 'archived'] as FilterStatus[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`filter-pill ${filter === f ? 'filter-pill--active' : ''}`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <select
          className="sort-select"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
        >
          <option value="created">Newest first</option>
          <option value="progress">By progress</option>
          <option value="tasks">Most tasks</option>
          <option value="title">Alphabetical</option>
        </select>
      </div>

      {/* List grid */}
      {lists.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state__icon">📋</span>
          <p>No lists match your filters.</p>
          <Link className="primary-button" to="/">Create a list</Link>
        </div>
      ) : (
        <div className="lists-grid">
          {lists.map((list) => (
            <ListCard key={list.id} list={list} />
          ))}
        </div>
      )}
    </section>
  );
}

function ListCard({ list }: { list: TodoList }) {
  const remaining = list.taskCount - list.completedTaskCount;
  return (
    <Link to="/lists/$listId" params={{ listId: list.id }} className="list-card">
      <div className="list-card__header">
        <div className="list-card__meta">
          <StatusBadge status={list.status} />
          <span className="list-card__date">
            {new Date(list.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        </div>
        <ProgressRing percent={list.completionPercent} size={52} />
      </div>
      <h3 className="list-card__title">{list.title}</h3>
      {list.description && <p className="list-card__desc">{list.description}</p>}
      <div className="list-card__bar">
        <div className="list-card__bar-fill" style={{ '--bar-pct': `${list.completionPercent}%` } as React.CSSProperties} />
      </div>
      <div className="list-card__footer">
        <span>{list.completedTaskCount}/{list.taskCount} tasks</span>
        {remaining > 0 && <span className="list-card__remaining">{remaining} remaining</span>}
        {list.completionPercent === 100 && <span className="list-card__done">✓ Done</span>}
      </div>
    </Link>
  );
}
