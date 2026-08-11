import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { appServices } from '../app/runtime/appServices';
import { listQueryOptions, listTasksQueryOptions } from '../core/contracts/queryKeys';
import { useTaskMutations } from '../core/mutations/useTaskMutations';
import { TaskDetailLens } from '../components/TaskDetailLens';
import { usePageSEO, PAGE_SEO } from '../hooks/usePageSEO';
import { supportsCollaboration } from '../core/contracts/repository';

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

  if (listQuery.isLoading || tasksQuery.isLoading || (supportsCollaboration(appServices.repository) && accessQuery.isLoading)) return <main className="task-focus-page" aria-busy="true">Loading task…</main>;
  if (!task || !listQuery.data) return <main className="task-focus-page"><h1>Task not found</h1><button className="secondary-button" onClick={() => navigate({ to: '/lists/$listId', params: { listId } })}>Back to list</button></main>;
  const canEdit = !supportsCollaboration(appServices.repository) || (accessQuery.data === 'owner' || accessQuery.data === 'editor');

  return <main className="task-focus-page">
    <button className="task-focus-page__back" onClick={() => navigate({ to: '/lists/$listId', params: { listId } })}>← Back to {listQuery.data.title}</button>
    <TaskDetailLens
      task={task}
      listTitle={listQuery.data.title}
      mode="focus"
      readOnly={listQuery.data.status === 'archived' || !canEdit}
      onUpdate={async (input) => { await mutations.updateTask.mutateAsync({ taskId, input }); }}
      onComplete={async () => { if (task.status === 'done') await mutations.updateTask.mutateAsync({ taskId, input: { status: 'todo' } }); else await mutations.completeTask.mutateAsync({ taskId, isComplete: true }); }}
    />
  </main>;
}
