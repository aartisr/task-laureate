-- Single, database-authoritative answer for the current user's relationship to
-- a resource. UI may use this for affordances, but RLS remains the enforcement
-- boundary for every mutation.
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
      select 1 from public.collaboration_tasks resource
      where resource.id = p_resource_id and resource.owner_id = (select auth.uid())
    ) then 'owner'
    when p_resource_type = 'task' then (
      select member.role from public.task_collaborators member
      where member.task_id = p_resource_id and member.user_id = (select auth.uid())
      limit 1
    )
    else null
  end;
$$;

grant execute on function public.get_collaboration_resource_access(text, uuid) to authenticated;
notify pgrst, 'reload schema';
