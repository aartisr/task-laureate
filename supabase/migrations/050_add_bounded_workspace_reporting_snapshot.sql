-- Analytical pages must not issue one task read for every List. This function
-- returns one RLS-scoped, bounded snapshot and explicitly reports truncation.
create or replace function public.get_collaboration_workspace_report(p_task_limit integer default 300)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with limits as (
    select greatest(1, least(coalesce(p_task_limit, 300), 500))::integer as task_limit
  ), visible_lists as (
    select list.id, list.title, list.description, list.status, list.created_at, list.updated_at, list.deleted_at,
      count(task.id) filter (where task.status <> 'deleted')::integer as task_count,
      count(task.id) filter (where task.status = 'done')::integer as completed_task_count
    from public.collaboration_lists list
    left join public.collaboration_tasks task on task.list_id = list.id
    where list.status <> 'deleted' and private.can_read_list(list.id)
    group by list.id
  ), visible_tasks as (
    select task.id, task.list_id, task.title, task.note_document, task.status, task.priority, task.due_date, task.tags,
      task.order_key, task.created_at, task.updated_at, task.completed_at, task.deleted_at, list.title as list_title
    from public.collaboration_tasks task
    join public.collaboration_lists list on list.id = task.list_id
    where task.status <> 'deleted' and list.status <> 'deleted' and private.can_read_list(list.id)
    order by task.completed_at desc nulls last, task.updated_at desc, task.id desc
    limit (select task_limit from limits)
  ), task_total as (
    select count(*)::integer as count
    from public.collaboration_tasks task
    join public.collaboration_lists list on list.id = task.list_id
    where task.status <> 'deleted' and list.status <> 'deleted' and private.can_read_list(list.id)
  )
  select jsonb_build_object(
    'lists', coalesce((select jsonb_agg(to_jsonb(visible_lists) order by case status when 'active' then 0 when 'completed' then 1 when 'archived' then 2 else 3 end, updated_at desc, id desc) from visible_lists), '[]'::jsonb),
    'tasks', coalesce((select jsonb_agg(to_jsonb(visible_tasks) order by completed_at desc nulls last, updated_at desc, id desc) from visible_tasks), '[]'::jsonb),
    'task_limit', (select task_limit from limits),
    'is_truncated', (select count > task_limit from task_total cross join limits)
  );
$$;

grant execute on function public.get_collaboration_workspace_report(integer) to authenticated;
notify pgrst, 'reload schema';
