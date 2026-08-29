import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { PageContainer, EmptyState, LoadingState, Grid, Card, Section } from '../components/layouts';
import { queryKeys } from '../core/contracts/queryKeys';
import { getDashboardCompletionPercent } from '../core/domain/logic';
import { useListMutations } from '../core/mutations/useListMutations';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { announceToScreenReader } from '../lib/a11y';
import { appServices } from '../app/runtime/appServices';
import { usePageSEO, PAGE_SEO } from '../hooks/usePageSEO';
import { AppIcon } from '../components/AppIcon';
import { ListComposer } from '../components/ListComposer';
import { ShareResourcePanel } from '../components/ShareResourcePanel';
import { supportsCollaboration, type TodoListInput } from '../core/contracts/repository';
import type { TodoList } from '../core/contracts/domain';
import { clearPendingSaveIntent, getPendingSaveIntent, requireSignInForSave } from '../core/auth/pendingSave';
import { useListCreationCommand } from '../hooks/useListCreationCommand';
import { sortListsForAttention } from '../core/domain/listOrdering';
import { FavoriteListButton } from '../components/FavoriteListButton';
import { ListShareButton } from '../components/ListShareButton';

export function DashboardPage() {
  usePageSEO(PAGE_SEO.dashboard);
  const navigate = useNavigate();
  const repository = appServices.repository;
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [sharingList, setSharingList] = useState<TodoList | null>(null);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const pendingSave = getPendingSaveIntent();
  const pendingList = pendingSave?.kind === 'list' && pendingSave.returnTo === '/' ? pendingSave : null;

  const openComposer = useCallback(() => {
    setIsCreatingList(true);
  }, []);

  useListCreationCommand(openComposer);

  useEffect(() => {
    const requestedFromNavigation = new URLSearchParams(window.location.search).get('newList') === '1';
    if (requestedFromNavigation) {
      openComposer();
      // The creation affordance is a one-shot command. Keep refresh/back from
      // unexpectedly reopening it after someone has acted or cancelled.
      window.history.replaceState(window.history.state, '', window.location.pathname);
    }
  }, [openComposer]);

  const { data: dashboard, isLoading } = useSuspenseQuery({
    queryKey: queryKeys.dashboard,
    queryFn: () => repository.getDashboard(),
    staleTime: 5000,
  });

  const listMutations = useListMutations({
    repository,
    userId: 'user-1',
  });

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onNewList: openComposer,
    onFocusSearch: () => navigate({ to: '/search' }),
  });

  const handleCreateList = async (input: TodoListInput) => {
    try {
      if (!await requireSignInForSave({ kind: 'list', input, returnTo: '/' })) return;
      const result = await listMutations.createList.mutateAsync(input);
      clearPendingSaveIntent();
      announceToScreenReader(`List “${result.title}” created`);
      navigate({
        to: `/lists/${result.id}`,
      });
    } catch (error) {
      console.error('Failed to create list:', error);
      announceToScreenReader('Failed to create list', 'assertive');
    }
  };

  const stats = useMemo(() => {
    if (!dashboard) return null;
    const { summary } = dashboard;
    const completionPercent = getDashboardCompletionPercent(summary);
    
    return {
      activeLists: summary.listCount,
      completedLists: summary.completedListCount ?? 0,
      totalLists: summary.listCount + (summary.completedListCount ?? 0),
      totalTasks: summary.taskCount,
      completedTasks: summary.completedCount,
      activeTasks: summary.activeCount,
      completionPercent,
    };
  }, [dashboard]);

  if (isLoading) {
    return (
      <PageContainer title="Dashboard" ariaLabel="Dashboard loading">
        <LoadingState message="Loading dashboard..." />
      </PageContainer>
    );
  }

  if (!stats || !dashboard) {
    return (
      <PageContainer title="Dashboard" ariaLabel="Dashboard">
        <EmptyState title="No data available" description="Unable to load your dashboard" />
      </PageContainer>
    );
  }

  const isEmptyWorkspace = stats.totalLists === 0 && stats.totalTasks === 0;
  // The home screen is a launchpad, not a history report. A list that just
  // completed receives a newer updatedAt and would otherwise displace work
  // that still needs attention.
  const activeRecentLists = sortListsForAttention(dashboard.lists.filter((list) => list.status === 'active'));

  const footer = (
    <details className="page-shortcuts">
      <summary>Keyboard shortcuts</summary>
      <nav className="flex flex-wrap gap-4 justify-center text-xs" aria-label="Keyboard shortcuts">
        <div><kbd className="bg-[var(--color-bg-secondary)] px-2 py-1 rounded">⌘N</kbd> New List</div>
        <div><kbd className="bg-[var(--color-bg-secondary)] px-2 py-1 rounded">⌘F</kbd> Search</div>
      </nav>
    </details>
  );

  return (
    <PageContainer
      title="Dashboard"
      subtitle="Welcome back! Here's your productivity snapshot."
      ariaLabel="Dashboard"
      spacing="spacious"
      footer={footer}
    >
      <section className="dashboard-primary-action panel" aria-label={isEmptyWorkspace ? 'Start your first list' : 'Start your work'} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'flex-start' }}>
        <div className="dashboard-primary-action__content" style={{ width: '100%' }}>
          <p className="eyebrow">Start here</p>
          <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{isEmptyWorkspace ? 'Start with one simple list.' : 'What\'s on your mind?'}</h2>
          <p>{isEmptyWorkspace ? 'Name one area of work first. You can add tasks when you are ready.' : 'Instantly offload a task, idea, or reminder.'}</p>
        </div>
        
        {isEmptyWorkspace ? (
          <button type="button" className="primary-button dashboard-primary-action__cta" onClick={() => { clearPendingSaveIntent(); openComposer(); }}>Create a list <AppIcon name="arrow-right" /></button>
        ) : (
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', width: '100%' }}>
            <button
              type="button"
              className="primary-button hover-scale"
              style={{ flex: 1, minWidth: '240px', padding: '1rem 1.5rem', fontSize: '1.125rem', justifyContent: 'flex-start', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-default)', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}
              onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, shiftKey: true }))}
            >
              <span style={{ opacity: 0.5, marginRight: '0.75rem' }}><AppIcon name="plus" /></span> Quick Capture...
            </button>
            <button
              type="button"
              className="primary-button hover-scale"
              style={{ padding: '1rem 1.5rem', fontSize: '1.125rem', background: '#4f46e5', color: '#fff', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)' }}
              onClick={() => window.dispatchEvent(new CustomEvent('open-voice-assistant'))}
              aria-label="Use Voice Assistant"
            >
              🎙️ Voice Input
            </button>
          </div>
        )}
      </section>

      <details className="dashboard-details"><summary>Workspace snapshot</summary><Grid columns={4} gap="normal">
        <Card variant="elevated" ariaLabel="Lists summary" onClick={() => navigate({ to: '/lists-overview' })}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
              Lists
            </h3>
            <span className="text-2xl" aria-hidden="true">
              <AppIcon name="list" />
            </span>
          </div>
          <p
            className="text-3xl font-bold text-[var(--color-text-primary)]"
            aria-label={`${stats.activeLists} lists in progress and ${stats.completedLists} completed lists`}
          >
            {stats.totalLists}
          </p>
          <p className="text-xs text-[var(--color-text-tertiary)] mt-2"><span className="font-medium text-[var(--color-text-primary)]">{stats.activeLists}</span> in progress · <span className="font-medium text-[var(--color-status-success)]">{stats.completedLists}</span> completed</p>
        </Card>

        <Card variant="elevated" ariaLabel="Tasks summary" onClick={() => navigate({ to: '/tasks' })}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
              Tasks
            </h3>
            <span className="text-2xl" aria-hidden="true">
              <AppIcon name="task" />
            </span>
          </div>
          <p
            className="text-3xl font-bold text-[var(--color-text-primary)]"
            aria-label={`${stats.activeTasks} tasks remaining and ${stats.completedTasks} completed tasks`}
          >
            {stats.totalTasks}
          </p>
          <p className="text-xs text-[var(--color-text-tertiary)] mt-2"><span className="font-medium text-[var(--color-text-primary)]">{stats.activeTasks}</span> remaining · <span className="font-medium text-[var(--color-status-success)]">{stats.completedTasks}</span> completed</p>
        </Card>

        <Card variant="elevated" ariaLabel="Completed tasks summary" onClick={() => navigate({ to: '/completed' })}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
              Completed
            </h3>
            <span className="text-2xl" aria-hidden="true">
              <AppIcon name="check" />
            </span>
          </div>
          <p
            className="text-3xl font-bold text-[var(--color-status-success)]"
            aria-label={`Completed tasks: ${stats.completedTasks}`}
          >
            {stats.completedTasks}
          </p>
          <p className="text-xs text-[var(--color-text-tertiary)] mt-2">See your wins →</p>
        </Card>

        <Card variant="elevated" ariaLabel="Completion progress" onClick={() => navigate({ to: '/progress' })}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
              Progress
            </h3>
            <span className="text-2xl" aria-hidden="true">
              <AppIcon name="progress" />
            </span>
          </div>
          <p
            className="text-3xl font-bold text-[var(--color-action-primary)]"
            aria-label={`Completion rate: ${stats.completionPercent} percent`}
          >
            {stats.completionPercent}%
          </p>
          <div
            className="w-full bg-[var(--color-border-default)] rounded-full h-2 mt-3"
            role="progressbar"
            aria-valuenow={stats.completionPercent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="bg-[var(--color-action-primary)] h-2 rounded-full transition-all duration-300"
              style={{ width: `${stats.completionPercent}%` }}
              aria-hidden="true"
            />
          </div>
          <p className="text-xs text-[var(--color-text-tertiary)] mt-2">View insights →</p>
        </Card>
      </Grid></details>

      {/* Quick Actions */}
      {(isCreatingList || pendingList) ? <ListComposer initialInput={pendingList?.input} restoredDraft={Boolean(pendingList)} onCreate={handleCreateList} onCancel={() => { clearPendingSaveIntent(); setIsCreatingList(false); }} /> : null}
      <details className="dashboard-details quick-actions-wrapper"><summary>Workspace tools</summary>
        <Grid columns={3} gap="normal">
          <Card onClick={() => { clearPendingSaveIntent(); openComposer(); }} ariaLabel="Create a new list">
            <div className="text-4xl mb-4 text-[var(--color-action-primary)]" aria-hidden="true">
              <AppIcon name="plus" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">New List</h3>
            <p className="text-sm text-[var(--color-text-secondary)]">Start a new project</p>
            <p className="text-xs text-[var(--color-text-tertiary)] mt-4">Cmd+N</p>
          </Card>
          <Card onClick={() => navigate({ to: '/search' })} ariaLabel="Search for tasks and lists">
            <div className="text-4xl mb-4 text-[var(--color-action-primary)]" aria-hidden="true">
              <AppIcon name="search" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">Search</h3>
            <p className="text-sm text-[var(--color-text-secondary)]">Find anything</p>
            <p className="text-xs text-[var(--color-text-tertiary)] mt-4">Cmd+F</p>
          </Card>
          <Card onClick={() => window.dispatchEvent(new Event('open-voice-assistant'))} ariaLabel="Open Voice Assistant">
            <div className="text-4xl mb-4 text-[var(--color-action-primary)]" aria-hidden="true">
              <AppIcon name="play" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">Voice Assistant</h3>
            <p className="text-sm text-[var(--color-text-secondary)]">Hands-free capture</p>
            <p className="text-xs text-[var(--color-text-tertiary)] mt-4">Cmd+Shift+V</p>
          </Card>
        </Grid>
        <p className="text-sm text-[var(--color-text-secondary)]">Prefer to look around first? <Link to="/sample">Explore the private sample</Link>.</p>
      </details>

      {/* The dashboard only surfaces work that can be acted on. Completion is
          celebrated in its dedicated history surface, not mixed into the next-action queue. */}
      {activeRecentLists.length > 0 ? (
        <div className="recent-lists-section">
          <Section title="Continue where you left off" description="Only lists with work remaining — your finished work is safely in Completed.">
            <Grid columns={3} gap="normal">
            {activeRecentLists.slice(0, 3).map((list) => {
              const listCompletion =
                list.taskCount > 0 ? Math.round((list.completedTaskCount / list.taskCount) * 100) : 0;
              return (
                <Card key={list.id} ariaLabel={`${list.title}, ${list.completedTaskCount} of ${list.taskCount} tasks completed, ${listCompletion}% progress`}>
                  <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">{list.title}</h3>
                  {list.description && (
                    <p className="text-sm text-[var(--color-text-secondary)] mb-4 line-clamp-2">
                      {list.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-xs text-[var(--color-text-tertiary)] mb-3">
                    <span>{list.taskCount} tasks</span>
                    <span>{listCompletion}% done</span>
                  </div>
                  {list.taskCount > 0 && (
                    <div
                      className="w-full bg-[var(--color-border-default)] rounded-full h-1.5"
                      role="progressbar"
                      aria-valuenow={listCompletion}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className="bg-[var(--color-status-success)] h-1.5 rounded-full"
                        style={{ width: `${listCompletion}%` }}
                        aria-hidden="true"
                      />
                    </div>
                  )}
                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    <button type="button" className="secondary-button" onClick={() => navigate({ to: `/lists/${list.id}` })}>Open List</button>
                    <FavoriteListButton listId={list.id} listTitle={list.title} />
                    <ListShareButton listTitle={list.title} onClick={() => {
                      if (supportsCollaboration(repository)) { setShareNotice(null); setSharingList(list); }
                      else setShareNotice('Sharing will be available once this workspace connects to secure collaboration storage. Sign in and apply the collaboration migrations, then try again.');
                    }} />
                  </div>
                </Card>
              );
            })}
          </Grid>
          {activeRecentLists.length > 3 && (
            <div className="text-center mt-8">
              <button
                onClick={() => navigate({ to: '/lists-overview' })}
                className="text-[var(--color-action-primary)] hover:text-[var(--color-action-hover)] font-medium text-sm focus:outline-none focus:underline"
                aria-label={`View all ${activeRecentLists.length} lists in progress`}
              >
                See all in-progress lists →
              </button>
            </div>
          )}
        </Section>
        </div>
      ) : stats.completedLists > 0 ? (
        <section className="panel text-center" aria-label="All current lists are complete">
          <p className="eyebrow">Clear runway</p>
          <h2>Everything is complete.</h2>
          <p className="text-[var(--color-text-secondary)] mt-2">Enjoy the win, review your completed work, or begin the next small thing.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3"><button type="button" className="secondary-button" onClick={() => navigate({ to: '/completed' })}>See completed work</button><button type="button" className="primary-button" onClick={() => { clearPendingSaveIntent(); openComposer(); }}>Start a new list <AppIcon name="arrow-right" /></button></div>
        </section>
      ) : null}
      {sharingList && supportsCollaboration(repository) ? <ShareResourcePanel repository={repository} resource={{ resourceType: 'list', resourceId: sharingList.id }} resourceName={sharingList.title} onClose={() => setSharingList(null)} /> : null}
      {shareNotice ? <div className="mt-6 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-950" role="status"><div className="flex items-start justify-between gap-3"><span>{shareNotice}</span><button type="button" className="font-semibold underline" onClick={() => setShareNotice(null)}>Dismiss</button></div></div> : null}
    </PageContainer>
  );
}
