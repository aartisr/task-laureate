-- Compatibility migration for databases that applied 024 before the compact
-- list-level Dependency Pulse projection was added.
create or replace function public.get_task_dependency_summaries(p_task_ids uuid[])
returns table (task_id uuid, unresolved_prerequisite_count integer, dependent_count integer)
language sql stable security invoker set search_path = '' as $$
  with requested as (select distinct unnest(p_task_ids) as task_id)
  select requested.task_id,
    count(edge.id) filter (
      where edge.dependent_task_id = requested.task_id
        and edge.is_required
        and edge.dependency_type = 'finish_to_start'
        and prerequisite.status <> 'done'
        and prerequisite.deleted_at is null
    )::integer as unresolved_prerequisite_count,
    count(edge.id) filter (where edge.prerequisite_task_id = requested.task_id)::integer as dependent_count
  from requested
  left join public.task_dependencies edge on edge.dependent_task_id = requested.task_id or edge.prerequisite_task_id = requested.task_id
  left join public.collaboration_tasks prerequisite on prerequisite.id = edge.prerequisite_task_id
  group by requested.task_id;
$$;

grant execute on function public.get_task_dependency_summaries(uuid[]) to authenticated;
notify pgrst, 'reload schema';
