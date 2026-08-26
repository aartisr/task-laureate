-- The dashboard is a next-action surface. Completion remains available in
-- reporting and the completed-list shelf, but must not outrank active work
-- simply because completing its last task updated its timestamp.
create or replace function public.get_collaboration_dashboard(p_recent_limit integer default 6)
returns jsonb language sql stable security definer set search_path = '' as $$
  with visible_lists as (
    select list.*,
      count(task.id) filter (where task.status <> 'deleted')::int as task_count,
      count(task.id) filter (where task.status = 'done' and task.status <> 'deleted')::int as completed_task_count
    from public.collaboration_lists list
    left join public.collaboration_tasks task on task.list_id = list.id
    where list.status <> 'deleted' and private.can_read_list(list.id)
    group by list.id
  ), summary as (
    select count(*) filter (where status = 'active')::int as list_count,
      count(*) filter (where status = 'completed')::int as completed_list_count,
      coalesce(sum(task_count), 0)::int as task_count,
      coalesce(sum(completed_task_count), 0)::int as completed_count
    from visible_lists
  )
  select jsonb_build_object(
    'summary', jsonb_build_object('listCount', summary.list_count, 'completedListCount', summary.completed_list_count, 'taskCount', summary.task_count, 'completedCount', summary.completed_count, 'activeCount', summary.task_count - summary.completed_count),
    'lists', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'title', title, 'description', description, 'status', status, 'created_at', created_at, 'updated_at', updated_at, 'deleted_at', deleted_at, 'task_count', task_count, 'completed_task_count', completed_task_count) order by updated_at desc, id desc)
      from (
        select * from visible_lists
        where status = 'active'
        order by updated_at desc, id desc
        limit greatest(1, least(p_recent_limit, 24))
      ) recent
    ), '[]'::jsonb)
  ) from summary;
$$;

grant execute on function public.get_collaboration_dashboard(integer) to authenticated;
notify pgrst, 'reload schema';
