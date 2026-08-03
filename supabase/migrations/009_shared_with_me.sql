-- Recipient-facing index. This exposes only resources directly shared with the
-- caller, never their private workspace or an owner’s roster.
create or replace function public.list_shared_resources()
returns table(resource_type text, resource_id uuid, title text, description text, role text, shared_by uuid, updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select 'list'::text, list.id, list.title, list.description, member.role, member.granted_by, list.updated_at
  from public.list_collaborators member
  join public.collaboration_lists list on list.id = member.list_id
  where member.user_id = (select auth.uid()) and list.owner_id <> (select auth.uid()) and list.status <> 'deleted'
  union all
  select 'task'::text, task.id, task.title, '', member.role, member.granted_by, task.updated_at
  from public.task_collaborators member
  join public.collaboration_tasks task on task.id = member.task_id
  where member.user_id = (select auth.uid()) and task.owner_id <> (select auth.uid()) and task.status <> 'deleted'
  order by updated_at desc;
$$;

grant execute on function public.list_shared_resources() to authenticated;
