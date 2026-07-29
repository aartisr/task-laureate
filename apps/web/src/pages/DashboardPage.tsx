import { useMemo, useState, useRef } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { PageContainer, EmptyState, LoadingState, Grid, Card, Section } from '../components/layouts';
import { queryKeys } from '../core/contracts/queryKeys';
import { useListMutations } from '../core/mutations/useListMutations';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { announceToScreenReader, createId } from '../lib/a11y';
import { appServices } from '../app/runtime/appServices';

export function DashboardPage() {
  const navigate = useNavigate();
  const repository = appServices.repository;
  const [isCreatingList, setIsCreatingList] = useState(false);
  const listTitleInputRef = useRef<HTMLInputElement>(null);

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

  const handleCreateList = async () => {
    try {
      const result = await listMutations.createList.mutateAsync({
        title: 'New List',
        description: '',
      });
      announceToScreenReader('New list created');
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
    const completionPercent = summary.taskCount > 0 
      ? Math.round((summary.completedCount / summary.taskCount) * 100)
      : 0;
    
    return {
      totalLists: summary.listCount,
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
    <div className="text-center text-sm text-[var(--color-text-secondary)]">
      <p className="mb-3">⌨️ Keyboard Shortcuts</p>
      <nav className="flex flex-wrap gap-4 justify-center text-xs" aria-label="Keyboard shortcuts">
        <div>
          <kbd className="bg-[var(--color-bg-secondary)] px-2 py-1 rounded">⌘N</kbd> New List
        </div>
        <div>
          <kbd className="bg-[var(--color-bg-secondary)] px-2 py-1 rounded">⌘F</kbd> Search
        </div>
      </nav>
    </div>
  );

  return (
    <PageContainer
      title="Dashboard"
      subtitle="Welcome back! Here's your productivity snapshot."
      ariaLabel="Dashboard"
      spacing="spacious"
      footer={footer}
    >
      {/* Summary Stats */}
      <Grid columns={4} gap="normal">
        <Card variant="elevated" ariaLabel="Lists summary">
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
            aria-label={`Total lists: ${stats.totalLists}`}
          >
            {stats.totalLists}
          </p>
          <p className="text-xs text-[var(--color-text-tertiary)] mt-2">Total list collections</p>
        </Card>

        <Card variant="elevated" ariaLabel="Tasks summary">
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
            aria-label={`Total tasks: ${stats.totalTasks}`}
          >
            {stats.totalTasks}
          </p>
          <p className="text-xs text-[var(--color-text-tertiary)] mt-2">Total tasks created</p>
        </Card>

        <Card variant="elevated" ariaLabel="Completed tasks summary">
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
          <p className="text-xs text-[var(--color-text-tertiary)] mt-2">Tasks finished</p>
        </Card>

        <Card variant="elevated" ariaLabel="Completion progress">
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
        </Card>
      </Grid>

      {/* Quick Actions */}
      <div className="quick-actions-wrapper">
        <Grid columns={2} gap="normal">
          <Card onClick={handleCreateList} ariaLabel="Create a new list">
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
        </div>

      {/* Recent Lists Section */}
      {dashboard.lists.length > 0 ? (
        <div className="recent-lists-section">
          <Section title="Recent Lists" description="Your most recent projects">
            <Grid columns={3} gap="normal">
            {dashboard.lists.slice(0, 6).map((list) => {
              const listCompletion =
                list.taskCount > 0 ? Math.round((list.completedTaskCount / list.taskCount) * 100) : 0;
              return (
                <Card
                  key={list.id}
                  onClick={() => navigate({ to: `/lists/${list.id}` })}
                  ariaLabel={`${list.title}, ${list.completedTaskCount} of ${list.taskCount} tasks completed, ${listCompletion}% progress`}
                >
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
            onClick: handleCreateList,
          }}
        />
      )}
    </PageContainer>
  );
}
