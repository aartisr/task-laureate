import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { appServices } from '../app/runtime/appServices';
import { dashboardQueryOptions, queryKeys } from '../core/contracts/queryKeys';
import { DEFAULT_PAGE_SIZE } from '../core/domain/cursorPage';
import { useListMutations } from '../core/mutations/useListMutations';
import { announceToScreenReader } from '../lib/a11y';
import { isRecentlyCompleted, archiveRecommendation } from '../core/domain/listLifecycle';
import type { TodoList, TodoListStatus } from '../core/contracts/domain';
import { usePageSEO, PAGE_SEO } from '../hooks/usePageSEO';
import { ShareResourcePanel } from '../components/ShareResourcePanel';
import { supportsCollaboration } from '../core/contracts/repository';
import { requestListCreation } from '../hooks/useListCreationCommand';
import { AppIcon } from '../components/AppIcon';

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
    completed: { label: 'Completed', cls: 'badge--completed' },
    archived: { label: 'Archived', cls: 'badge--archived' },
    deleted: { label: 'Deleted', cls: 'badge--deleted' },
  };
  const { label, cls } = map[status];
  return <span className={`status-badge ${cls}`}>{label}</span>;
}

export function ListsPage() {
  usePageSEO(PAGE_SEO.listsOverview);
  const navigate = useNavigate();
  const { data } = useQuery(dashboardQueryOptions(appServices.repository));
  const [filter, setFilter] = useState<FilterStatus>('active');
  const [sort, setSort] = useState<SortKey>('created');
  const [search, setSearch] = useState('');
  const [cursor, setCursor] = useState<string | null>(null);
  const [cursorHistory, setCursorHistory] = useState<Array<string | null>>([]);
  const [sharingList, setSharingList] = useState<TodoList | null>(null);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const pageInput = { cursor, limit: DEFAULT_PAGE_SIZE, status: filter === 'all' ? undefined : filter, query: search, sort };
  const { data: page, isFetching } = useQuery({
    queryKey: queryKeys.listsPage(pageInput),
    queryFn: () => appServices.repository.listListsPage(pageInput),
  });
  const { data: completedPage } = useQuery({
    queryKey: queryKeys.listsPage({ cursor: null, limit: 5, status: 'completed', sort: 'created' }),
    queryFn: () => appServices.repository.listListsPage({ limit: 5, status: 'completed', sort: 'created' }),
  });
  const sharedListsQuery = useQuery({
    queryKey: ['collaboration', 'shared-resources'],
    queryFn: () => supportsCollaboration(appServices.repository) ? appServices.repository.listSharedResources() : Promise.resolve([]),
    enabled: supportsCollaboration(appServices.repository),
    staleTime: 30_000,
  });
  const listMutations = useListMutations({ repository: appServices.repository, userId: 'user-1' });
  const reuseList = async (source: TodoList) => {
    const copy = await appServices.repository.createList({ title: `${source.title} (new run)`, description: source.description, templateId: source.templateId });
    const tasks = await appServices.repository.listTasks(source.id);
    await Promise.all(tasks.map((task) => appServices.repository.createTask({ listId: copy.id, title: task.title, notes: task.notes, priority: task.priority, tags: task.tags })));
    await appServices.queryClient.invalidateQueries({ queryKey: queryKeys.lists });
    announceToScreenReader(`Created a fresh run of “${source.title}” with ${tasks.length} tasks.`);
  };

  const lists = page?.items ?? [];
  const allLists = data?.lists ?? [];
  const sharedListRoles = new Map((sharedListsQuery.data ?? []).filter((resource) => resource.resourceType === 'list').map((resource) => [resource.resourceId, resource.role]));
  const accessIsResolved = !supportsCollaboration(appServices.repository) || (!sharedListsQuery.isLoading && !sharedListsQuery.isError);
  const canManage = (listId: string) => accessIsResolved && !sharedListRoles.has(listId);

  const totalTasks = allLists.reduce((s, l) => s + l.taskCount, 0);
  const avgProgress =
    lists.length > 0
      ? Math.round(allLists.reduce((s, l) => s + l.completionPercent, 0) / allLists.length)
      : 0;
  const doneCount = allLists.filter((l) => l.completionPercent === 100).length;
  const resetPage = () => { setCursor(null); setCursorHistory([]); };

  return (
    <section className="page-stack">
      <header className="page-hero">
        <div>
          <p className="eyebrow">Overview</p>
          <h1>All Lists</h1>
          <p className="lede">
            {page?.total ?? 0} matching list{(page?.total ?? 0) !== 1 ? 's' : ''} · {totalTasks} tasks total · {avgProgress}% avg progress
          </p>
        </div>
      </header>

      {/* Keep collection-level reporting available without delaying the list-finding task. */}
      <details className="page-insights">
        <summary>See workspace totals</summary>
        <div className="summary-row">
        <div className="summary-chip">
          <span className="summary-chip__value">{page?.total ?? 0}</span>
          <span className="summary-chip__label">Matching lists</span>
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
      </details>

      {/* Controls */}
      <div className="list-controls">
        <input
          className="list-search"
          aria-label="Filter lists"
          placeholder="Filter lists…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); resetPage(); }}
        />
        <div className="filter-group">
          {(['active', 'completed', 'archived', 'all'] as FilterStatus[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => { setFilter(f); resetPage(); }}
              className={`filter-pill ${filter === f ? 'filter-pill--active' : ''}`}
            >
              {{ active: 'In progress', completed: 'Completed', archived: 'Archive', deleted: 'Deleted', all: 'All lists' }[f]}
            </button>
          ))}
        </div>
        <select
          className="sort-select"
          aria-label="Sort lists"
          value={sort}
          onChange={(e) => { setSort(e.target.value as SortKey); resetPage(); }}
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
          <img className="empty-state__brand-mark" src="/icons/task-laureate-mark.svg" alt="" aria-hidden="true" />
          <p>No lists match your filters.</p>
          <button type="button" className="primary-button" onClick={() => { requestListCreation(); void navigate({ to: '/' }); }}><AppIcon name="plus" /> Create a list</button>
        </div>
      ) : (
        <div className="lists-grid">
          {lists.map((list) => (
            <ListCard key={list.id} list={list} onDelete={async () => {
              await listMutations.deleteList.mutateAsync(list.id);
              announceToScreenReader(`List “${list.title}” moved to deleted items. You can undo this from the undo centre.`);
            }} onArchive={async () => { await listMutations.archiveList.mutateAsync(list.id); announceToScreenReader(`List “${list.title}” archived. You can restore it at any time.`); }} onRestore={async () => { await listMutations.restoreList.mutateAsync(list.id); announceToScreenReader(`List “${list.title}” restored.`); }} onReuse={() => reuseList(list)} canManage={canManage(list.id)} onShare={() => { if (supportsCollaboration(appServices.repository)) { setShareNotice(null); setSharingList(list); } else setShareNotice('Sharing will be available once this workspace connects to secure collaboration storage. Sign in and apply the collaboration migrations, then try again.'); }} />
          ))}
        </div>
      )}
      {filter === 'active' && !search && (completedPage?.items ?? []).some((list) => isRecentlyCompleted(list)) && (
        <section className="completed-shelf" aria-label="Completed recently">
          <div className="completed-shelf__heading"><div><p className="eyebrow">A record of progress</p><h2>Completed recently</h2><p>Your finished work stays close for 30 days. Reopen, reuse, or archive when it no longer needs attention.</p></div><button type="button" className="text-sm font-medium text-green-900 underline" onClick={() => { setFilter('completed'); resetPage(); }}>View all completed</button></div>
          <div className="lists-grid">{completedPage!.items.filter((list) => isRecentlyCompleted(list)).map((list) => <ListCard key={list.id} list={list} onDelete={async () => { await listMutations.deleteList.mutateAsync(list.id); }} onArchive={async () => { await listMutations.archiveList.mutateAsync(list.id); }} onRestore={async () => { await listMutations.restoreList.mutateAsync(list.id); }} onReuse={() => reuseList(list)} canManage={canManage(list.id)} onShare={() => { if (supportsCollaboration(appServices.repository)) { setShareNotice(null); setSharingList(list); } else setShareNotice('Sharing will be available once this workspace connects to secure collaboration storage. Sign in and apply the collaboration migrations, then try again.'); }} />)}</div>
        </section>
      )}
      {lists.length > 0 && (
        <nav className="flex items-center justify-between border-t border-gray-200 pt-5" aria-label="List pages">
          <button type="button" className="secondary-button" disabled={cursorHistory.length === 0 || isFetching} onClick={() => { const previous = cursorHistory.at(-1) ?? null; setCursorHistory((history) => history.slice(0, -1)); setCursor(previous); }}>Previous</button>
          <span className="text-sm text-gray-600">Showing {lists.length} of {page?.total ?? 0}</span>
          <button type="button" className="secondary-button" disabled={!page?.nextCursor || isFetching} onClick={() => { setCursorHistory((history) => [...history, cursor]); setCursor(page!.nextCursor); }}>Next</button>
        </nav>
      )}
      {sharingList && supportsCollaboration(appServices.repository) ? <ShareResourcePanel repository={appServices.repository} resource={{ resourceType: 'list', resourceId: sharingList.id }} resourceName={sharingList.title} onClose={() => setSharingList(null)} /> : null}
      {shareNotice ? <div className="mt-5 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-950" role="status"><div className="flex items-start justify-between gap-3"><span>{shareNotice}</span><button type="button" className="font-semibold underline" onClick={() => setShareNotice(null)}>Dismiss</button></div></div> : null}
    </section>
  );
}

function ListCard({ list, onDelete, onArchive, onRestore, onReuse, onShare, canManage }: { list: TodoList; onDelete: () => Promise<void>; onArchive: () => Promise<void>; onRestore: () => Promise<void>; onReuse: () => Promise<void>; onShare: () => void; canManage: boolean }) {
  const remaining = list.taskCount - list.completedTaskCount;
  const [manageOpen, setManageOpen] = useState(false);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const run = async (action: () => Promise<void>) => {
    setIsSaving(true);
    try { await action(); setManageOpen(false); setDeleteArmed(false); }
    catch { announceToScreenReader('That change could not be saved. Please try again.', 'assertive'); }
    finally { setIsSaving(false); }
  };
  return (
    <article className="list-card">
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
        {list.completionPercent === 100 && <span className="list-card__done"><AppIcon name="check" /> Done</span>}
      </div>
      <div className="list-card__actions">
        <Link to="/lists/$listId" params={{ listId: list.id }} className="primary-button list-card__open">Open list <AppIcon name="arrow-right" /></Link>
        {canManage ? <><button type="button" className="list-card__share" onClick={onShare} aria-label={`Share List: ${list.title}`}><AppIcon name="share" />Share</button><button type="button" aria-expanded={manageOpen} className="secondary-button list-card__manage" onClick={() => setManageOpen((open) => !open)}>Manage</button></> : null}
      </div>
      {canManage && manageOpen && <div className="list-card__menu" aria-label={`Manage ${list.title}`}>
        {list.status === 'completed' && <><p className="list-card__menu-copy">This run is complete. Its history is preserved.</p><button type="button" className="list-card__menu-action list-card__menu-action--archive" disabled={isSaving} onClick={() => void run(onReuse)}><AppIcon name="undo" /> Start a fresh run</button></>}
        {list.status === 'archived' ? <button type="button" className="list-card__menu-action list-card__menu-action--archive" disabled={isSaving} onClick={() => void run(onRestore)}><AppIcon name="undo" /> Restore to {list.archivedFromStatus === 'completed' ? 'completed' : 'in progress'}</button> : <button type="button" className="list-card__menu-action list-card__menu-action--archive" disabled={isSaving} onClick={() => void run(onArchive)}><AppIcon name="archive" /> {archiveRecommendation(list) ? 'Archive recommended' : 'Archive from daily view'}</button>}
        {deleteArmed ? <div className="list-card__danger"><span>Move to deleted items? You can undo this.</span><div className="list-card__danger-actions"><button type="button" className="list-card__menu-action list-card__menu-action--danger" disabled={isSaving} onClick={() => void run(onDelete)}><AppIcon name="trash" /> Yes, delete</button><button type="button" className="list-card__menu-action list-card__menu-action--cancel" onClick={() => setDeleteArmed(false)}>Cancel</button></div></div> : <button type="button" className="list-card__menu-action list-card__menu-action--delete" onClick={() => setDeleteArmed(true)}><AppIcon name="trash" /> Delete list…</button>}
      </div>}
    </article>
  );
}
