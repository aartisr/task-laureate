-- Human-readable collaboration identity is needed by the resource owner, but
-- account emails must never be exposed through the broad membership RLS read.
-- These owner-only RPCs are the single, audited display boundary.

create or replace function public.list_resource_collaborators(
  p_resource_type text,
  p_resource_id uuid
)
returns table (
  user_id uuid,
  email text,
  role text,
  granted_by uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql security definer set search_path = '' as $$
begin
  if p_resource_type = 'list' then
    if not private.can_manage_list_access(p_resource_id) then raise exception 'Only the List owner can view collaborator identities'; end if;
    return query
      select member.user_id, lower(account.email), member.role, member.granted_by, member.created_at, member.updated_at
      from public.list_collaborators member
      join auth.users account on account.id = member.user_id
      where member.list_id = p_resource_id
      order by lower(account.email);
  elsif p_resource_type = 'task' then
    if not private.can_manage_task_access(p_resource_id) then raise exception 'Only the Task owner can view collaborator identities'; end if;
    return query
      select member.user_id, lower(account.email), member.role, member.granted_by, member.created_at, member.updated_at
      from public.task_collaborators member
      join auth.users account on account.id = member.user_id
      where member.task_id = p_resource_id
      order by lower(account.email);
  end if;

  raise exception 'Invalid resource type';
end;
$$;

-- Preserve the established function identity while adding a human-readable
-- owner-only display field to the assignment picker.
drop function if exists public.list_task_assignment_candidates(uuid);
create function public.list_task_assignment_candidates(p_task_id uuid)
returns table (user_id uuid, email text, access_role text)
language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_manage_task_access(p_task_id) then raise exception 'Only the Task owner can view assignee candidates'; end if;
  return query
  select candidate.user_id, lower(account.email), min(candidate.access_role)
  from (
    select list.owner_id as user_id, 'owner'::text as access_role
    from public.collaboration_tasks task join public.collaboration_lists list on list.id = task.list_id where task.id = p_task_id
    union all
    select member.user_id, member.role from public.collaboration_tasks task join public.list_collaborators member on member.list_id = task.list_id where task.id = p_task_id
    union all
    select member.user_id, member.role from public.task_collaborators member where member.task_id = p_task_id
  ) candidate
  join auth.users account on account.id = candidate.user_id
  group by candidate.user_id, account.email
  order by min(candidate.access_role), lower(account.email);
end;
$$;

revoke all on function public.list_resource_collaborators(text, uuid) from public;
grant execute on function public.list_resource_collaborators(text, uuid) to authenticated;
revoke all on function public.list_task_assignment_candidates(uuid) from public;
grant execute on function public.list_task_assignment_candidates(uuid) to authenticated;
notify pgrst, 'reload schema';
