-- Mixed list views are still useful for browsing history, but never let a
-- recently completed list take an active list's place. The standard active
-- filter remains the default; this is the safe fallback for "All lists".
create or replace function public.list_collaboration_lists_page(p_status text default null, p_query text default null, p_cursor timestamptz default null, p_limit integer default 24)
returns table(id uuid, title text, description text, status text, created_at timestamptz, updated_at timestamptz, deleted_at timestamptz, task_count integer, completed_task_count integer, next_cursor timestamptz)
language sql stable security definer set search_path = '' as $$
  with visible as (
    select list.*, count(task.id) filter (where task.status <> 'deleted')::int as task_count,
      count(task.id) filter (where task.status = 'done')::int as completed_task_count
    from public.collaboration_lists list
    left join public.collaboration_tasks task on task.list_id = list.id
    where list.status <> 'deleted' and private.can_read_list(list.id)
      and (p_status is null or list.status = p_status)
      and (p_query is null or p_query = '' or list.title ilike '%' || p_query || '%' or list.description ilike '%' || p_query || '%')
    group by list.id
    having p_cursor is null or list.updated_at < p_cursor
    order by case list.status when 'active' then 0 when 'completed' then 1 when 'archived' then 2 else 3 end, list.updated_at desc, list.id desc
    limit greatest(1, least(p_limit, 100))
  )
  select id, title, description, status, created_at, updated_at, deleted_at, task_count, completed_task_count,
    (select min(updated_at) from visible)
  from visible;
$$;

grant execute on function public.list_collaboration_lists_page(text, text, timestamptz, integer) to authenticated;
notify pgrst, 'reload schema';
