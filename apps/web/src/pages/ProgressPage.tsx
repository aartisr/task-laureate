import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { appServices } from '../app/runtime/appServices';
import { dashboardQueryOptions, listTasksQueryOptions } from '../core/contracts/queryKeys';
import type { TodoItem, Priority } from '../core/contracts/domain';
import { formatDateOnly, isDueDateBeforeToday, isDueDateToday } from '../core/domain/dateOnly';
import { usePageSEO, PAGE_SEO } from '../hooks/usePageSEO';

const PRIORITY_ORDER: Priority[] = ['urgent', 'high', 'medium', 'low'];
const PRIORITY_META: Record<Priority, { label: string; icon: string; color: string }> = {
  urgent: { label: 'Urgent', icon: '🔴', color: 'var(--color-error, #ef4444)' },
  high:   { label: 'High',   icon: '🟠', color: 'var(--color-warning, #f97316)' },
  medium: { label: 'Medium', icon: '🟡', color: 'var(--color-accent, #eab308)' },
  low:    { label: 'Low',    icon: '🟢', color: 'var(--color-success, #22c55e)' },
};

function RadialProgress({ pct, size = 80, label }: { pct: number; size?: number; label?: string }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const fill = (pct / 100) * circ;
  return (
    <svg width={size} height={size} className="radial-progress" role="img" aria-label={`${pct}% complete`}>
      <circle cx={size / 2} cy={size / 2} r={r} className="radial-progress__track" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        className="radial-progress__fill"
        strokeDasharray={`${fill} ${circ}`}
        strokeDashoffset={circ / 4}
      />
      <text x="50%" y="46%" textAnchor="middle" className="radial-progress__value">{pct}%</text>
      {label && (
        <text x="50%" y="64%" textAnchor="middle" className="radial-progress__sub">{label}</text>
      )}
    </svg>
  );
}

function HorizontalBar({ pct, color }: { pct: number; color?: string }) {
  return (
    <div className="h-bar">
      <div className="h-bar__fill" style={{ '--bar-w': `${pct}%`, '--bar-color': color } as React.CSSProperties} />
    </div>
  );
}

function useAllTasks() {
  const { data: dashboard } = useQuery(dashboardQueryOptions(appServices.repository));
  const listIds = (dashboard?.lists ?? []).map((l) => l.id);
  const listMap = Object.fromEntries((dashboard?.lists ?? []).map((l) => [l.id, l]));

  const listTaskQueries = listIds.map((id) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useQuery({ ...listTasksQueryOptions(appServices.repository, id), enabled: !!id })
  );

  const allTasks: Array<TodoItem & { listTitle: string }> = listIds.flatMap((id, i) =>
    (listTaskQueries[i].data ?? [])
      .filter((t) => t.deletedAt === null)
      .map((t) => ({ ...t, listTitle: listMap[id]?.title ?? id }))
  );

  const loading = listTaskQueries.some((q) => q.isLoading);
  return { allTasks, loading, lists: dashboard?.lists ?? [] };
}

export function ProgressPage() {
  usePageSEO(PAGE_SEO.progress);
  const { allTasks, loading, lists } = useAllTasks();

  if (loading) return <div className="page-surface">Loading progress…</div>;

  const total = allTasks.length;
  const done = allTasks.filter((t) => t.status === 'done').length;
  const doing = allTasks.filter((t) => t.status === 'doing').length;
  const blocked = allTasks.filter((t) => t.status === 'blocked').length;
  const todo = allTasks.filter((t) => t.status === 'todo').length;
  const overallPct = total > 0 ? Math.round((done / total) * 100) : 0;

  // Priority breakdown
  const byPriority = PRIORITY_ORDER.map((p) => {
    const pts = allTasks.filter((t) => t.priority === p);
    const donePts = pts.filter((t) => t.status === 'done').length;
    return { priority: p, total: pts.length, done: donePts, pct: pts.length > 0 ? Math.round((donePts / pts.length) * 100) : 0 };
  }).filter((g) => g.total > 0);

  // Overdue tasks
  const now = new Date();
  const overdue = allTasks.filter((t) => t.dueDate && t.status !== 'done' && isDueDateBeforeToday(t.dueDate, now));
  const dueToday = allTasks.filter((t) => {
    if (!t.dueDate || t.status === 'done') return false;
    return isDueDateToday(t.dueDate, now);
  });

  // Lists sorted by progress
  const sortedLists = [...lists].sort((a, b) => b.completionPercent - a.completionPercent);
  const topList = sortedLists[0];
  const behindList = [...lists].sort((a, b) => a.completionPercent - b.completionPercent)[0];

  // Status distribution for donut-like bar
  const statusData = [
    { label: 'Done', count: done, color: 'var(--color-success, #22c55e)' },
    { label: 'Doing', count: doing, color: 'var(--color-action-primary, #8b5cf6)' },
    { label: 'To do', count: todo, color: 'var(--color-text-tertiary, #6b7280)' },
    { label: 'Blocked', count: blocked, color: 'var(--color-error, #ef4444)' },
  ].filter((s) => s.count > 0);

  return (
    <section className="page-stack">
      <header className="page-hero page-hero--gradient">
        <div>
          <p className="eyebrow">Progress</p>
          <h1>How far you've come</h1>
          <p className="lede">
            {done} of {total} tasks done · {overallPct}% overall completion
          </p>
        </div>
        <div className="hero-actions">
          <Link className="secondary-button" to="/">← Dashboard</Link>
        </div>
      </header>

      {/* Top KPIs */}
      <div className="kpi-row">
        <div className="kpi-card kpi-card--primary">
          <RadialProgress pct={overallPct} size={100} label="overall" />
          <div className="kpi-card__text">
            <strong>Overall completion</strong>
            <p>{done} done out of {total} total tasks</p>
          </div>
        </div>
        {overdue.length > 0 && (
          <div className="kpi-card kpi-card--warn">
            <span className="kpi-card__big">{overdue.length}</span>
            <div className="kpi-card__text">
              <strong>Overdue</strong>
              <p>Tasks past their due date</p>
              <Link to="/tasks" className="kpi-card__link">View →</Link>
            </div>
          </div>
        )}
        {dueToday.length > 0 && (
          <div className="kpi-card kpi-card--accent">
            <span className="kpi-card__big">{dueToday.length}</span>
            <div className="kpi-card__text">
              <strong>Due today</strong>
              <p>Tasks due before midnight</p>
              <Link to="/tasks" className="kpi-card__link">View →</Link>
            </div>
          </div>
        )}
        <div className="kpi-card">
          <span className="kpi-card__big">{doing}</span>
          <div className="kpi-card__text">
            <strong>Active now</strong>
            <p>Tasks currently in progress</p>
          </div>
        </div>
      </div>

      {/* Status distribution */}
      <div className="panel">
        <div className="panel-heading">
          <div><p className="eyebrow">Breakdown</p><h2>Status distribution</h2></div>
        </div>
        {/* Stacked bar */}
        <div className="stacked-bar" role="img" aria-label="Status distribution bar">
          {statusData.map((s) => (
            <div
              key={s.label}
              className="stacked-bar__segment"
              style={{ '--seg-w': `${Math.round((s.count / total) * 100)}%`, '--seg-color': s.color } as React.CSSProperties}
              title={`${s.label}: ${s.count}`}
            />
          ))}
        </div>
        <div className="stacked-bar__legend">
          {statusData.map((s) => (
            <div key={s.label} className="stacked-bar__legend-item">
              <span className="stacked-bar__dot" style={{ '--dot-color': s.color } as React.CSSProperties} />
              <span>{s.label}</span>
              <strong>{s.count}</strong>
              <span className="stacked-bar__pct">({Math.round((s.count / total) * 100)}%)</span>
            </div>
          ))}
        </div>
      </div>

      {/* Priority breakdown */}
      <div className="panel">
        <div className="panel-heading">
          <div><p className="eyebrow">Priority</p><h2>Completion by priority</h2></div>
        </div>
        <div className="priority-breakdown">
          {byPriority.map((row) => {
            const pm = PRIORITY_META[row.priority];
            return (
              <div key={row.priority} className="priority-row">
                <span className="priority-row__icon">{pm.icon}</span>
                <span className="priority-row__label">{pm.label}</span>
                <div className="priority-row__bar">
                  <HorizontalBar pct={row.pct} color={pm.color} />
                </div>
                <span className="priority-row__stat">{row.done}/{row.total}</span>
                <span className="priority-row__pct">{row.pct}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lists leaderboard */}
      <div className="panel">
        <div className="panel-heading">
          <div><p className="eyebrow">Lists</p><h2>Progress by list</h2></div>
          <Link to="/lists-overview" className="panel-heading__action">See all →</Link>
        </div>
        {topList && (
          <div className="insight-chips">
            <div className="insight-chip insight-chip--success">
              🏆 Leading: <strong>{topList.title}</strong> at {topList.completionPercent}%
            </div>
            {behindList && behindList.id !== topList.id && (
              <div className="insight-chip insight-chip--warn">
                🎯 Needs attention: <strong>{behindList.title}</strong> at {behindList.completionPercent}%
              </div>
            )}
          </div>
        )}
        <div className="lists-leaderboard">
          {sortedLists.map((l, idx) => {
            const tasksDone = allTasks.filter((t) => t.listId === l.id && t.status === 'done').length;
            const tasksTotal = allTasks.filter((t) => t.listId === l.id).length;
            return (
              <Link key={l.id} to="/lists/$listId" params={{ listId: l.id }} className="leaderboard-row">
                <span className="leaderboard-row__rank">
                  {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                </span>
                <span className="leaderboard-row__name">{l.title}</span>
                <div className="leaderboard-row__bar">
                  <div className="leaderboard-row__fill" style={{ '--fill-w': `${l.completionPercent}%` } as React.CSSProperties} />
                </div>
                <span className="leaderboard-row__stat">{tasksDone}/{tasksTotal}</span>
                <span className="leaderboard-row__pct">{l.completionPercent}%</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Overdue detail */}
      {overdue.length > 0 && (
        <div className="panel panel--warn">
          <div className="panel-heading">
            <div><p className="eyebrow">Action needed</p><h2>Overdue tasks</h2></div>
            <Link to="/tasks" className="panel-heading__action">Manage →</Link>
          </div>
          <div className="task-group__list">
            {overdue.slice(0, 5).map((t) => (
              <div key={t.id} className="task-row task-row--overdue">
                <span className="task-row__check" />
                <div className="task-row__body">
                  <span className="task-row__title">{t.title}</span>
                  <div className="task-row__chips">
                    <Link to="/lists/$listId" params={{ listId: t.listId }} className="task-row__list-link">
                      📋 {t.listTitle}
                    </Link>
                    <span className="due-badge due-badge--overdue">
                      📅 {formatDateOnly(t.dueDate, 'en-US', { month: 'short', day: 'numeric' })} · Overdue
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {overdue.length > 5 && (
              <Link to="/tasks" className="view-all-link">+ {overdue.length - 5} more overdue tasks →</Link>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
