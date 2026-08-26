import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import type { TodoItem } from '../core/contracts/domain';
import { usePageSEO, PAGE_SEO } from '../hooks/usePageSEO';
import { useAllListTasks } from '../hooks/useAllListTasks';

export function CompletedPage() {
  usePageSEO(PAGE_SEO.completed);
  const { allTasks, loading, lists, isTruncated } = useAllListTasks();
  const [groupBy, setGroupBy] = useState<'list' | 'date'>('date');

  if (loading) return <div className="page-surface">Loading…</div>;

  const completed = allTasks.filter((t) => t.status === 'done');
  const completionRate = allTasks.length > 0 ? Math.round((completed.length / allTasks.length) * 100) : 0;

  // Group by list
  const byList = lists.map((l) => ({
    id: l.id,
    title: l.title,
    total: allTasks.filter((t) => t.listId === l.id).length,
    done: completed.filter((t) => t.listId === l.id),
    pct: l.completionPercent,
  })).filter((g) => g.done.length > 0);

  // Group by date (completedAt or updatedAt)
  function completedDate(t: TodoItem) {
    return t.completedAt ?? t.updatedAt;
  }
  const byDateMap = new Map<string, typeof completed>();
  completed.forEach((t) => {
    const d = new Date(completedDate(t)).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    });
    if (!byDateMap.has(d)) byDateMap.set(d, []);
    byDateMap.get(d)!.push(t);
  });
  const byDate = [...byDateMap.entries()]
    .sort((a, b) => new Date(completedDate(b[1][0])).getTime() - new Date(completedDate(a[1][0])).getTime())
    .map(([date, tasks]) => ({ date, tasks }));

  // Recent milestone computation
  const last7days = completed.filter((t) => {
    const d = new Date(completedDate(t));
    const now = new Date();
    return (now.getTime() - d.getTime()) < 7 * 86400 * 1000;
  }).length;

  return (
    <section className="page-stack">
      <header className="page-hero page-hero--success">
        <div>
          <p className="eyebrow">Completed</p>
          <h1>Wins worth celebrating 🎉</h1>
          <p className="lede">
            {completed.length} task{completed.length !== 1 ? 's' : ''} completed — {completionRate}% of all tasks
          </p>
        </div>
        <div className="hero-actions">
          <Link className="secondary-button" to="/">← Dashboard</Link>
        </div>
      </header>

      {isTruncated ? <p className="page-notice" role="status">Showing the most recent 300 tasks in this report. Your Lists and task search still include everything.</p> : null}

      {/* Summary row */}
      <div className="summary-row">
        <div className="summary-chip summary-chip--success">
          <span className="summary-chip__value">{completed.length}</span>
          <span className="summary-chip__label">Done</span>
        </div>
        <div className="summary-chip summary-chip--accent">
          <span className="summary-chip__value">{completionRate}%</span>
          <span className="summary-chip__label">Completion rate</span>
        </div>
        <div className="summary-chip">
          <span className="summary-chip__value">{last7days}</span>
          <span className="summary-chip__label">Last 7 days</span>
        </div>
        <div className="summary-chip">
          <span className="summary-chip__value">{byList.filter((g) => g.pct === 100).length}</span>
          <span className="summary-chip__label">Lists 100% done</span>
        </div>
      </div>

      {/* Per-list progress bars */}
      <div className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">By list</p>
            <h2>Completion by list</h2>
          </div>
        </div>
        <div className="completion-bars">
          {lists.map((l) => {
            const total = allTasks.filter((t) => t.listId === l.id).length;
            const done = completed.filter((t) => t.listId === l.id).length;
            return (
              <Link key={l.id} to="/lists/$listId" params={{ listId: l.id }} className="completion-bar-row">
                <span className="completion-bar-row__name">{l.title}</span>
                <div className="completion-bar-row__track">
                  <div
                    className="completion-bar-row__fill"
                    style={{ '--bar-pct': `${l.completionPercent}%` } as React.CSSProperties}
                  />
                </div>
                <span className="completion-bar-row__stat">{done}/{total}</span>
                <span className="completion-bar-row__pct">{l.completionPercent}%</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Controls */}
      <div className="list-controls">
        <div className="filter-group">
          <span className="filter-group__label">Group by</span>
          {(['date', 'list'] as const).map((g) => (
            <button
              key={g}
              onClick={() => setGroupBy(g)}
              className={`filter-pill ${groupBy === g ? 'filter-pill--active' : ''}`}
            >
              {g === 'date' ? 'Date' : 'List'}
            </button>
          ))}
        </div>
      </div>

      {completed.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state__icon">🎯</span>
          <p>No completed tasks yet. Start checking things off!</p>
          <Link className="primary-button" to="/tasks">View all tasks</Link>
        </div>
      ) : groupBy === 'date' ? (
        <div className="task-groups">
          {byDate.map(({ date, tasks }) => (
            <div key={date} className="task-group">
              <div className="task-group__header">
                <span>📅</span>
                <h3>{date}</h3>
                <span className="task-group__count">{tasks.length}</span>
              </div>
              <div className="task-group__list">
                {tasks.map((task) => (
                  <CompletedTaskRow key={task.id} task={task} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="task-groups">
          {byList.map(({ id, title, done, total }) => (
            <div key={id} className="task-group">
              <div className="task-group__header">
                <span>📋</span>
                <h3>{title}</h3>
                <span className="task-group__count">{done.length}/{total}</span>
              </div>
              <div className="task-group__list">
                {done.map((task) => (
                  <CompletedTaskRow key={task.id} task={task} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function CompletedTaskRow({ task }: { task: TodoItem & { listTitle: string } }) {
  const completedOn = task.completedAt ?? task.updatedAt;
  return (
    <div className="task-row task-row--done">
      <span className="task-row__check task-row__check--done">✓</span>
      <div className="task-row__body">
        <span className="task-row__title">{task.title}</span>
        <div className="task-row__chips">
          <Link to="/lists/$listId" params={{ listId: task.listId }} className="task-row__list-link">
            📋 {task.listTitle}
          </Link>
          <span className="completed-on">
            ✅ {new Date(completedOn).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
          {task.tags.map((tag) => (
            <span key={tag} className="tag-chip">{tag}</span>
          ))}
        </div>
        {task.notes && <p className="task-row__notes">{task.notes}</p>}
      </div>
    </div>
  );
}
