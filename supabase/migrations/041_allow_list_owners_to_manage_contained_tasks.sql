-- A List is the owning boundary for its Tasks. Earlier data can contain a
-- Task owner that differs from its List owner (for example, after an import
-- or an older client write). The List owner must still be able to administer
-- every contained Task without transferring ownership or weakening access for
-- collaborators.
create or replace function private.can_manage_task_access(target_task_id uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.collaboration_tasks task
    join public.collaboration_lists list on list.id = task.list_id
    where task.id = target_task_id
      and (task.owner_id = (select auth.uid()) or list.owner_id = (select auth.uid()))
  );
$$;

-- Keep the browser's access affordances aligned with the database boundary:
-- a List owner is also the effective owner of every Task inside that List.
create or replace function public.get_collaboration_resource_access(p_resource_type text, p_resource_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select case
    when p_resource_type = 'list' and exists (
      select 1 from public.collaboration_lists resource
      where resource.id = p_resource_id and resource.owner_id = (select auth.uid())
    ) then 'owner'
    when p_resource_type = 'list' then (
      select member.role from public.list_collaborators member
      where member.list_id = p_resource_id and member.user_id = (select auth.uid())
      limit 1
    )
    when p_resource_type = 'task' and exists (
      select 1
      from public.collaboration_tasks task
      join public.collaboration_lists list on list.id = task.list_id
      where task.id = p_resource_id
        and (task.owner_id = (select auth.uid()) or list.owner_id = (select auth.uid()))
    ) then 'owner'
    when p_resource_type = 'task' then (
      select member.role from public.task_collaborators member
      where member.task_id = p_resource_id and member.user_id = (select auth.uid())
      limit 1
    )
    else null
  end;
$$;

revoke all on function private.can_manage_task_access(uuid) from public;
revoke all on function public.get_collaboration_resource_access(text, uuid) from public;
grant execute on function public.get_collaboration_resource_access(text, uuid) to authenticated;
notify pgrst, 'reload schema';
