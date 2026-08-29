-- Bounded, read-only collaboration queries. They use the same private access
-- predicates as RLS, but avoid shipping an entire workspace to the browser.
create index if not exists collaboration_lists_visible_updated_idx on public.collaboration_lists (updated_at desc, id desc) where status <> 'deleted';
create index if not exists collaboration_tasks_list_visible_order_idx on public.collaboration_tasks (list_id, order_key, id) where status <> 'deleted';
create index if not exists collaboration_tasks_visible_updated_idx on public.collaboration_tasks (updated_at desc, id desc) where status <> 'deleted';

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
    'lists', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'title', title, 'description', description, 'status', status, 'created_at', created_at, 'updated_at', updated_at, 'deleted_at', deleted_at, 'task_count', task_count, 'completed_task_count', completed_task_count) order by updated_at desc, id desc) from (select * from visible_lists order by updated_at desc, id desc limit greatest(1, least(p_recent_limit, 24))) recent), '[]'::jsonb)
  ) from summary;
$$;

create or replace function public.list_collaboration_task_feed(p_status text default null, p_priority text default null, p_query text default null, p_cursor timestamptz default null, p_limit integer default 50)
returns table(id uuid, list_id uuid, list_title text, title text, note_document text, status text, priority text, due_date date, tags text[], order_key numeric, created_at timestamptz, updated_at timestamptz, completed_at timestamptz, deleted_at timestamptz, next_cursor timestamptz)
language sql stable security definer set search_path = '' as $$
  with visible as (
    select task.*, list.title as list_title
    from public.collaboration_tasks task
    join public.collaboration_lists list on list.id = task.list_id
    where task.status <> 'deleted' and list.status <> 'deleted' and private.can_read_task(task.id)
      and (p_status is null or task.status = p_status)
      and (p_priority is null or task.priority = p_priority)
      and (p_query is null or p_query = '' or task.title ilike '%' || p_query || '%' or list.title ilike '%' || p_query || '%')
      and (p_cursor is null or task.updated_at < p_cursor)
    order by task.updated_at desc, task.id desc
    limit greatest(1, least(p_limit, 100))
  )
  select id, list_id, list_title, title, note_document, status, priority, due_date, tags, order_key, created_at, updated_at, completed_at, deleted_at,
    (select min(updated_at) from visible)
  from visible;
$$;

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
    order by list.updated_at desc, list.id desc
    limit greatest(1, least(p_limit, 100))
  )
  select id, title, description, status, created_at, updated_at, deleted_at, task_count, completed_task_count,
    (select min(updated_at) from visible)
  from visible;
$$;

grant execute on function public.get_collaboration_dashboard(integer) to authenticated;
grant execute on function public.list_collaboration_task_feed(text, text, text, timestamptz, integer) to authenticated;
grant execute on function public.list_collaboration_lists_page(text, text, timestamptz, integer) to authenticated;
notify pgrst, 'reload schema';
