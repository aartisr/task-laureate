import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { appServices } from '../app/runtime/appServices';
import { listQueryOptions, listTasksQueryOptions } from '../core/contracts/queryKeys';
import { useTaskMutations } from '../core/mutations/useTaskMutations';
import { TaskDetailLens } from '../components/TaskDetailLens';
import { usePageSEO, PAGE_SEO } from '../hooks/usePageSEO';
import { supportsCollaboration } from '../core/contracts/repository';
import { TaskExecutionControls } from '../components/TaskExecutionControls';
import { CalendarScheduleControl } from '../components/CalendarScheduleControl';
import { isFeatureEnabled } from '../config/featureFlags';
import { getCalendarTaskBlock } from '../infrastructure/calendar/calendarScheduling';
import { createTaskPlanningService } from '../core/services/taskPlanning';
import type { EffectiveRole } from '../core/domain/sharing';

/** The owner is the only person who can assign collaborators or send a nudge.
 * Editors may change the work itself, but cannot create outbound notifications. */
export function canManageTaskReminders(collaborationEnabled: boolean, accessRole: EffectiveRole | undefined) {
  return !collaborationEnabled || accessRole === 'owner';
}

export function TaskFocusPage({ listId, taskId }: { listId: string; taskId: string }) {
  const navigate = useNavigate();
  const listQuery = useQuery(listQueryOptions(appServices.repository, listId));
  const tasksQuery = useQuery(listTasksQueryOptions(appServices.repository, listId));
  const accessQuery = useQuery({
    queryKey: ['collaboration', 'resource-access', 'task', taskId],
    queryFn: () => supportsCollaboration(appServices.repository) ? appServices.repository.getResourceAccess({ resourceType: 'task', resourceId: taskId }) : Promise.resolve('owner' as const),
    enabled: supportsCollaboration(appServices.repository),
    staleTime: 30_000,
  });
  const mutations = useTaskMutations({ repository: appServices.repository, userId: 'user-1' });
  const task = tasksQuery.data?.find((item) => item.id === taskId);
  usePageSEO(PAGE_SEO.listDetail(task?.title ?? 'Task'));
  const calendarEnabled = isFeatureEnabled('calendarIntegration');
  const canEditTask = !supportsCollaboration(appServices.repository) || (accessQuery.data === 'owner' || accessQuery.data === 'editor');
  const planningQuery = useQuery({ queryKey: ['task-planning', taskId], queryFn: () => createTaskPlanningService(appServices.repository).get(taskId), enabled: calendarEnabled && !!task && canEditTask });
  const calendarBlockQuery = useQuery({ queryKey: ['calendar-block', taskId], queryFn: () => getCalendarTaskBlock(taskId), enabled: calendarEnabled && !!task && canEditTask, retry: false });

  if (listQuery.isLoading || tasksQuery.isLoading || (supportsCollaboration(appServices.repository) && accessQuery.isLoading)) return <main className="task-focus-page" aria-busy="true">Loading task…</main>;
  if (!task || !listQuery.data) return <main className="task-focus-page"><h1>Task not found</h1><button className="secondary-button" onClick={() => navigate({ to: '/lists/$listId', params: { listId } })}>Back to list</button></main>;
  const canEdit = canEditTask;
  const canManageReminders = canManageTaskReminders(supportsCollaboration(appServices.repository), accessQuery.data);

  return <main className="page-stack task-focus-page">
    <button className="task-focus-page__back" onClick={() => navigate({ to: '/lists/$listId', params: { listId } })}>← Back to {listQuery.data.title}</button>
    <TaskDetailLens
      task={task}
      listTitle={listQuery.data.title}
      mode="focus"
      readOnly={listQuery.data.status === 'archived' || !canEdit}
      canManageReminders={canManageReminders && listQuery.data.status !== 'archived'}
      onUpdate={async (input) => { await mutations.updateTask.mutateAsync({ taskId, input }); }}
      onComplete={async () => { if (task.status === 'done') await mutations.updateTask.mutateAsync({ taskId, input: { status: 'todo' } }); else await mutations.completeTask.mutateAsync({ taskId, isComplete: true }); }}
      onMove={async (destinationListId) => { await mutations.moveTask.mutateAsync({ taskId, destinationListId }); navigate({ to: '/lists/$listId', params: { listId: destinationListId } }); }}
    />
    {canEdit ? <TaskExecutionControls task={task} /> : null}
    {canEdit && calendarEnabled ? <CalendarScheduleControl task={task} scheduledStartAt={planningQuery.data?.scheduledStartAt} estimateMinutes={planningQuery.data?.estimateMinutes} existingBlock={calendarBlockQuery.data} onScheduled={async () => { await Promise.all([calendarBlockQuery.refetch(), planningQuery.refetch()]); }} /> : null}
  </main>;
}
