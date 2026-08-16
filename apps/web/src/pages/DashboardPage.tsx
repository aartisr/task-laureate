import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { PageContainer, EmptyState, LoadingState, Grid, Card, Section } from '../components/layouts';
import { queryKeys } from '../core/contracts/queryKeys';
import { getDashboardCompletionPercent } from '../core/domain/logic';
import { useListMutations } from '../core/mutations/useListMutations';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { announceToScreenReader, createId } from '../lib/a11y';
import { appServices } from '../app/runtime/appServices';
import { usePageSEO, PAGE_SEO } from '../hooks/usePageSEO';
import { ListComposer } from '../components/ListComposer';
import { ShareResourcePanel } from '../components/ShareResourcePanel';
import { supportsCollaboration, type TodoListInput } from '../core/contracts/repository';
import type { TodoList } from '../core/contracts/domain';
import { clearPendingSaveIntent, getPendingSaveIntent, requireSignInForSave } from '../core/auth/pendingSave';
import { useListCreationCommand } from '../hooks/useListCreationCommand';

export function DashboardPage() {
  usePageSEO(PAGE_SEO.dashboard);
  const navigate = useNavigate();
  const repository = appServices.repository;
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [sharingList, setSharingList] = useState<TodoList | null>(null);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const listTitleInputRef = useRef<HTMLInputElement>(null);
  const pendingSave = getPendingSaveIntent();
  const pendingList = pendingSave?.kind === 'list' && pendingSave.returnTo === '/' ? pendingSave : null;

  const openComposer = useCallback(() => {
    setIsCreatingList(true);
    window.setTimeout(() => listTitleInputRef.current?.focus(), 0);
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
    onNewList: () => {
      setIsCreatingList(true);
      setTimeout(() => listTitleInputRef.current?.focus(), 0);
    },
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
      <section className="dashboard-primary-action panel" aria-label="Start your work"><div className="dashboard-primary-action__content"><p className="eyebrow">Start here</p><h2>What deserves your attention now?</h2><p>Choose one feasible next action before looking at the whole workspace.</p></div><Link to="/now" className="primary-button dashboard-primary-action__cta">Open Now <span aria-hidden="true">→</span></Link></section>

      <details className="dashboard-details"><summary>Workspace snapshot</summary><Grid columns={4} gap="normal">
        <Card variant="elevated" ariaLabel="Lists summary" onClick={() => navigate({ to: '/lists-overview' })}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
              Lists
            </h3>
            <span className="text-2xl" aria-hidden="true">
              📋
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
              ✓
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
              🎉
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
              📈
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

      <section className="panel dashboard-onboarding" aria-label="Try Task-Laureate before signing in">
        <div className="dashboard-onboarding__content"><p className="eyebrow">Explore safely</p><h2>New to Task-Laureate?</h2><p>Explore a private, non-persistent sample before you decide whether to sign in and sync.</p></div>
        <Link to="/sample" className="secondary-button dashboard-onboarding__cta">Try the interactive sample <span aria-hidden="true">→</span></Link>
      </section>

      {/* Quick Actions */}
      {(isCreatingList || pendingList) ? <ListComposer titleInputRef={listTitleInputRef} initialInput={pendingList?.input} restoredDraft={Boolean(pendingList)} onCreate={handleCreateList} onCancel={() => { clearPendingSaveIntent(); setIsCreatingList(false); }} /> : null}
      <details className="dashboard-details quick-actions-wrapper"><summary>Workspace tools</summary>
        <Grid columns={2} gap="normal">
          <Card onClick={() => { clearPendingSaveIntent(); setIsCreatingList(true); }} ariaLabel="Create a new list">
            <div className="text-4xl mb-4" aria-hidden="true">
              ➕
            </div>
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">Create New List</h3>
            <p className="text-sm text-[var(--color-text-secondary)]">Start a new project or category</p>
            <p className="text-xs text-[var(--color-text-tertiary)] mt-4">Or press Cmd+N</p>
          </Card>

          <Card onClick={() => navigate({ to: '/search' })} ariaLabel="Search for tasks and lists">
            <div className="text-4xl mb-4" aria-hidden="true">
              🔍
            </div>
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">Search</h3>
            <p className="text-sm text-[var(--color-text-secondary)]">Find tasks across all lists</p>
            <p className="text-xs text-[var(--color-text-tertiary)] mt-4">Or press Cmd+F</p>
          </Card>
        </Grid>
      </details>

      {/* Recent Lists Section */}
      {dashboard.lists.length > 0 ? (
        <div className="recent-lists-section">
          <Section title="Recent Lists" description="Your most recent projects">
            <Grid columns={3} gap="normal">
            {dashboard.lists.slice(0, 3).map((list) => {
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
                    <button type="button" className="list-card__share" onClick={() => {
                      if (supportsCollaboration(repository)) { setShareNotice(null); setSharingList(list); }
                      else setShareNotice('Sharing will be available once this workspace connects to secure collaboration storage. Sign in and apply the collaboration migrations, then try again.');
                    }} aria-label={`Share List: ${list.title}`}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" /></svg>Share</button>
                  </div>
                </Card>
              );
            })}
          </Grid>
          {dashboard.lists.length > 6 && (
            <div className="text-center mt-8">
              <button
                onClick={() => navigate({ to: '/lists' })}
                className="text-[var(--color-action-primary)] hover:text-[var(--color-action-hover)] font-medium text-sm focus:outline-none focus:underline"
                aria-label={`View all ${dashboard.lists.length} lists`}
              >
                View all {dashboard.lists.length} lists →
              </button>
            </div>
          )}
        </Section>
        </div>
      ) : (
        <EmptyState
          icon="📭"
          title="No lists yet"
          description="Create your first list to get started organizing your tasks."
          action={{
            label: 'Create First List',
            onClick: () => { clearPendingSaveIntent(); setIsCreatingList(true); },
          }}
        />
      )}
      {sharingList && supportsCollaboration(repository) ? <ShareResourcePanel repository={repository} resource={{ resourceType: 'list', resourceId: sharingList.id }} resourceName={sharingList.title} onClose={() => setSharingList(null)} /> : null}
      {shareNotice ? <div className="mt-6 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-950" role="status"><div className="flex items-start justify-between gap-3"><span>{shareNotice}</span><button type="button" className="font-semibold underline" onClick={() => setShareNotice(null)}>Dismiss</button></div></div> : null}
    </PageContainer>
  );
}
