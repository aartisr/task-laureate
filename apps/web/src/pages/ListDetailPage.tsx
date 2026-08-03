import { useState, useMemo, useRef } from 'react';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { queryKeys } from '../core/contracts/queryKeys';
import { useListMutations } from '../core/mutations/useListMutations';
import { useTaskMutations } from '../core/mutations/useTaskMutations';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { announceToScreenReader, createId } from '../lib/a11y';
import { TaskList } from '../components/TaskList';
import { TaskComposer } from '../components/TaskComposer';
import { ShareResourcePanel } from '../components/ShareResourcePanel';
import { ListAccessBanner } from '../components/ListAccessBanner';
import { appServices } from '../app/runtime/appServices';
import { supportsCollaboration } from '../core/contracts/repository';
import { usePageSEO, PAGE_SEO } from '../hooks/usePageSEO';
import { clearPendingSaveIntent, getPendingSaveIntent, requireSignInForSave } from '../core/auth/pendingSave';

export interface ListDetailPageProps {
  listId: string;
}

export function ListDetailPage({ listId }: ListDetailPageProps) {
  const navigate = useNavigate();
  const repository = appServices.repository;
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSharing, setShowSharing] = useState(false);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const taskInputRef = useRef<HTMLInputElement>(null);
  const pendingSave = getPendingSaveIntent();
  const pendingTask = pendingSave?.kind === 'task' && pendingSave.returnTo === `/lists/${listId}` ? pendingSave : null;

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onNewTask: () => {
      setIsCreatingTask(true);
      setTimeout(() => taskInputRef.current?.focus(), 0);
    },
    onFocusSearch: () => navigate({ to: '/search' }),
    onGoHome: () => navigate({ to: '/' }),
  });

  // Query data
  const { data: list, isLoading: listLoading } = useSuspenseQuery({
    queryKey: queryKeys.list(listId),
    queryFn: () => repository.getList(listId),
    staleTime: 5000,
  });

  // Dynamic SEO from list title
  usePageSEO(PAGE_SEO.listDetail(list?.title ?? 'List'));

  const { data: tasks = [], isLoading: tasksLoading } = useSuspenseQuery({
    queryKey: queryKeys.tasks(listId),
    queryFn: () => repository.listTasks(listId),
    staleTime: 5000,
  });

  // Resolve access directly from the database. A recipient list can never be
  // mistaken for an owner list because a cached aggregate happened to be stale.
  const accessQuery = useQuery({
    queryKey: ['collaboration', 'resource-access', 'list', listId],
    queryFn: () => supportsCollaboration(repository) ? repository.getResourceAccess({ resourceType: 'list', resourceId: listId }) : Promise.resolve('owner' as const),
    enabled: supportsCollaboration(repository),
    staleTime: 30_000,
  });

  // Mutations
  const listMutations = useListMutations({
    repository,
    userId: 'user-1',
  });

  const taskMutations = useTaskMutations({
    repository,
    userId: 'user-1',
  });

  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.completedAt !== null).length;
    const completionPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, completionPercent };
  }, [tasks]);

  const accessRole = accessQuery.data;
  const sharedRole = accessRole === 'editor' || accessRole === 'viewer' ? accessRole : null;
  const isSharedList = sharedRole !== null;
  // Avoid a brief owner-control flash while recipient access is being resolved.
  const accessPending = supportsCollaboration(repository) && accessQuery.isLoading;
  const accessUnavailable = supportsCollaboration(repository) && (accessQuery.isError || accessRole === null);
  const canEditTasks = !accessPending && !accessUnavailable && (!isSharedList || sharedRole === 'editor');
  const canManageList = !accessPending && !accessUnavailable && !isSharedList;

  if (listLoading) {
    return (
      <section className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-8" aria-label="List editor">
        <div className="text-center">
          <p className="text-gray-500" aria-live="polite" aria-busy="true">Loading list...</p>
        </div>
      </section>
    );
  }

  if (!list) {
    return (
      <section className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-8" aria-label="List editor">
        <div className="text-center">
          <p className="text-gray-500">List not found</p>
          <button
            onClick={() => navigate({ to: '/' })}
            className="mt-4 text-blue-600 hover:text-blue-800 font-medium focus:outline-none focus:underline"
            aria-label="Return to dashboard"
          >
            Back to Dashboard
          </button>
        </div>
      </section>
    );
  }

  const handleCreateTask = async (input: Parameters<typeof taskMutations.createTask.mutateAsync>[0]) => {
    try {
      if (!await requireSignInForSave({ kind: 'task', input, returnTo: `/lists/${listId}` })) return;
      await taskMutations.createTask.mutateAsync(input);
      clearPendingSaveIntent();
      announceToScreenReader(`Task "${input.title}" created.`);
      setIsCreatingTask(false);
    } catch (error) {
      console.error('Failed to create task:', error);
      announceToScreenReader('Failed to create task. Please try again.', 'assertive');
    }
  };

  const handleUpdateListTitle = async () => {
    if (!newTitle.trim() || newTitle === list.title) {
      setEditingTitle(false);
      return;
    }

    try {
      await listMutations.updateList.mutateAsync({
        listId,
        input: { title: newTitle.trim() },
      });
      announceToScreenReader(`List renamed to "${newTitle.trim()}".`);
      setEditingTitle(false);
    } catch (error) {
      console.error('Failed to update list:', error);
      announceToScreenReader('Failed to rename list. Please try again.', 'assertive');
      setNewTitle(list.title);
    }
  };

  const handleDeleteList = async () => {
    try {
      await listMutations.deleteList.mutateAsync(listId);
      announceToScreenReader('List deleted.');
      navigate({ to: '/' });
    } catch (error) {
      console.error('Failed to delete list:', error);
      announceToScreenReader('Failed to delete list. Please try again.', 'assertive');
    }
  };

  const handleArchiveList = async () => {
    try {
      await listMutations.archiveList.mutateAsync(listId);
      announceToScreenReader('List archived.');
      navigate({ to: '/' });
    } catch (error) {
      console.error('Failed to archive list:', error);
      announceToScreenReader('Failed to archive list. Please try again.', 'assertive');
    }
  };

  const handleReopenList = async () => {
    try {
      await listMutations.updateList.mutateAsync({ listId, input: { status: 'active' } });
      announceToScreenReader('List reopened. Add or reopen a task to continue work.');
    } catch (error) {
      console.error('Failed to reopen list:', error);
      announceToScreenReader('Failed to reopen list. Please try again.', 'assertive');
    }
  };

  const handleRestoreArchivedList = async () => {
    try {
      await listMutations.restoreList.mutateAsync(listId);
      announceToScreenReader('List restored. You can continue working whenever you are ready.');
    } catch (error) {
      console.error('Failed to restore list:', error);
      announceToScreenReader('Failed to restore list. Please try again.', 'assertive');
    }
  };

  return (
    <section className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-8" aria-label={`${list.title} list editor`}>
      <div className="max-w-4xl mx-auto">
        {/* Header with Back Button */}
        <header className="mb-8">
          <button
            onClick={() => navigate({ to: '/' })}
            className="text-blue-600 hover:text-blue-800 font-medium text-sm mb-4 focus:outline-none focus:underline"
            aria-label="Return to dashboard"
          >
            ← Back to Dashboard
          </button>

          {/* Title Section */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              {editingTitle ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleUpdateListTitle();
                      if (e.key === 'Escape') {
                        setEditingTitle(false);
                        setNewTitle(list.title);
                      }
                    }}
                    className="w-full text-3xl font-bold px-3 py-2 border-2 border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                    aria-label="Edit list title"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleUpdateListTitle}
                      className="px-4 py-2 bg-green-600 text-white rounded font-medium hover:bg-green-700 transition-colors text-sm"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingTitle(false);
                        setNewTitle(list.title);
                      }}
                      className="px-4 py-2 bg-gray-300 text-gray-700 rounded font-medium hover:bg-gray-400 transition-colors text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="list-title-control">
                  <h1 className="text-4xl font-bold text-gray-900">{list.title}</h1>
                  {canManageList && <button
                    type="button"
                    className="list-title-control__edit"
                    onClick={() => {
                      setEditingTitle(true);
                      setNewTitle(list.title);
                    }}
                    aria-label={`Edit list name: ${list.title}`}
                  >
                    <span aria-hidden="true">✎</span> Edit name
                  </button>}
                </div>
              )}
              {list.description && (
                <p className="text-gray-600 mt-2">{list.description}</p>
              )}
            </div>

            {canManageList && <div className="list-detail-actions" aria-label="List actions">
              <button
                type="button"
                onClick={() => {
                  if (supportsCollaboration(repository)) { setShareNotice(null); setShowSharing(true); }
                  else setShareNotice('Sharing is ready as soon as this workspace connects to secure collaboration storage. Sign in and apply the collaboration migrations, then try again.');
                }}
                title="Share this List with collaborators"
                className="share-list-action"
                aria-label={`Share list: ${list.title}`}
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" /></svg><span>Share</span>
              </button>
              <div className="list-detail-actions__utility" aria-label="More List actions">
              <button
                type="button"
                onClick={() => navigate({ to: '/activity' })}
                title="View activity"
                className="p-2 hover:bg-gray-200 rounded transition-colors"
                aria-label="View workspace activity"
              >
                📝
              </button>
              <button
                type="button"
                onClick={handleArchiveList}
                title="Archive list"
                className="p-2 hover:bg-yellow-100 text-yellow-600 rounded transition-colors"
                aria-label="Archive list"
              >
                📦
              </button>
              {showDeleteConfirm ? (
                <>
                  <button
                    type="button"
                    onClick={handleDeleteList}
                    className="px-3 py-2 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-3 py-2 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  title="Delete list"
                  className="p-2 hover:bg-red-100 text-red-600 rounded transition-colors"
                  aria-label="Delete list"
                >
                  🗑️
                </button>
              )}
              </div>
            </div>}
          </div>

          {sharedRole ? <ListAccessBanner role={sharedRole} /> : null}
          {accessUnavailable ? <p className="list-access-unavailable" role="status">We could not verify your List permissions. Editing and List controls are temporarily unavailable—refresh to retry.</p> : null}

          {list.status === 'completed' && (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-950" role="status">
              <span>✓ Completed {list.completedAt ? new Date(list.completedAt).toLocaleDateString() : ''}. Keep it as a record, archive it when it no longer needs attention, or reopen it.</span>
              {canManageList ? <button type="button" onClick={handleReopenList} className="shrink-0 rounded border border-green-700 px-3 py-1 font-medium text-green-900">Reopen</button> : null}
            </div>
          )}
          {list.status === 'archived' && (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950" role="status">
              <span>📦 Archived lists are safely preserved and read-only. Restore it to make changes.</span>
              {canManageList ? <button type="button" onClick={handleRestoreArchivedList} className="shrink-0 rounded border border-amber-700 px-3 py-1 font-medium text-amber-900">Restore list</button> : null}
            </div>
          )}

          {/* Stats */}
          <div className="mt-6 bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between text-sm">
              <div className="flex gap-6">
                <div>
                  <span className="font-medium text-gray-900">{stats.total}</span>
                  <span className="text-gray-600 ml-1">Total Tasks</span>
                </div>
                <div>
                  <span className="font-medium text-green-600">{stats.completed}</span>
                  <span className="text-gray-600 ml-1">Completed</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-32 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all"
                    style={{ width: `${stats.completionPercent}%` } as React.CSSProperties}
                  />
                </div>
                <span className="font-medium text-gray-900 w-12 text-right">
                  {stats.completionPercent}%
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Create Task Section */}
        {list.status !== 'archived' && canEditTasks && <section className="mb-8 bg-white rounded-lg shadow-md p-6" aria-label="Create new task">
          {isCreatingTask || pendingTask ? (
            <TaskComposer listId={listId} initialInput={pendingTask?.input} restoredDraft={Boolean(pendingTask)} onCreate={handleCreateTask} onCancel={() => { clearPendingSaveIntent(); setIsCreatingTask(false); }} titleInputRef={taskInputRef} />
          ) : (
            <button
              type="button"
              onClick={() => { clearPendingSaveIntent(); setIsCreatingTask(true); }}
              className="w-full text-left px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Click to add a new task"
            >
              <span className="text-2xl" aria-hidden="true">+</span> Add a task <span className="text-sm">— include a due date, priority, or notes when useful</span>
            </button>
          )}
        </section>}

        {/* Tasks Section */}
        <section className="task-list-shell" aria-label="Tasks list">
          <TaskList
            listId={listId}
            tasks={tasks}
            isLoading={tasksLoading}
            onTaskUpdate={async (id, input) => {
              await taskMutations.updateTask.mutateAsync({
                taskId: id,
                input,
              });
            }}
            onTaskComplete={async (id) => {
              const task = tasks.find((t) => t.id === id);
              if (task?.status === 'done') {
                await taskMutations.updateTask.mutateAsync({
                  taskId: id,
                  input: { status: 'todo' },
                });
              } else {
                await taskMutations.completeTask.mutateAsync({ taskId: id, isComplete: true });
              }
            }}
            onTaskDelete={async (id) => {
              await taskMutations.deleteTask.mutateAsync(id);
            }}
            onTaskRestore={async (id) => {
              await taskMutations.restoreTask.mutateAsync(id);
            }}
            readOnly={list.status === 'archived' || !canEditTasks}
            canManageReminders={canManageList && list.status !== 'archived'}
            readOnlyMessage={list.status === 'archived' ? 'Restore the list to edit or add work.' : accessPending ? 'Checking your access…' : accessUnavailable ? 'We could not verify your access. Refresh to retry.' : 'You have read-only access to this shared list. Only its owner can make changes.'}
          />
        </section>

        {/* Keyboard Shortcuts Hint */}
        <footer className="text-center mt-12 pt-8 border-t border-gray-200">
          <p className="text-xs text-gray-500 mb-2">⌨️ Keyboard Shortcuts</p>
          <nav className="flex flex-wrap gap-4 justify-center text-xs text-gray-600" aria-label="Keyboard shortcuts">
            <div>
              <kbd className="bg-gray-100 px-2 py-1 rounded">⌘T</kbd> New Task
            </div>
            <div>
              <kbd className="bg-gray-100 px-2 py-1 rounded">⌘F</kbd> Search
            </div>
            <div>
              <kbd className="bg-gray-100 px-2 py-1 rounded">⌘H</kbd> Home
            </div>
          </nav>
        </footer>
        {showSharing && supportsCollaboration(repository) ? <ShareResourcePanel repository={repository} resource={{ resourceType: 'list', resourceId: list.id }} resourceName={list.title} onClose={() => setShowSharing(false)} /> : null}
        {shareNotice ? <div className="mt-4 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-950" role="status"><div className="flex items-start justify-between gap-3"><span>{shareNotice}</span><button type="button" className="font-semibold underline" onClick={() => setShareNotice(null)}>Dismiss</button></div></div> : null}
      </div>
    </section>
  );
}
