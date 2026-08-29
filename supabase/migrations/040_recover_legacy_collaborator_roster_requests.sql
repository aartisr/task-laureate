-- Installed PWAs can keep an older collaboration client briefly after a
-- release. The roster is display-only, so an obsolete resource-type value
-- must not break sharing when the current owner can be determined safely from
-- the supplied resource ID. This helper never returns a type for a resource
-- the caller cannot manage.
create or replace function private.resolve_managed_resource_type(
  p_requested_resource_type text,
  p_resource_id uuid
)
returns text
language plpgsql stable security definer set search_path = '' as $$
declare normalized_resource_type text := lower(trim(coalesce(p_requested_resource_type, '')));
begin
  if normalized_resource_type in ('list', 'task') then
    return normalized_resource_type;
  end if;

  if private.can_manage_list_access(p_resource_id) then return 'list'; end if;
  if private.can_manage_task_access(p_resource_id) then return 'task'; end if;
  raise exception 'Invalid resource type';
end;
$$;

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
declare resolved_resource_type text := private.resolve_managed_resource_type(p_resource_type, p_resource_id);
begin
  if resolved_resource_type = 'list' then
    if not private.can_manage_list_access(p_resource_id) then raise exception 'Only the List owner can view collaborator identities'; end if;
    return query
      select member.user_id, lower(account.email), member.role, member.granted_by, member.created_at, member.updated_at
      from public.list_collaborators member
      join auth.users account on account.id = member.user_id
      where member.list_id = p_resource_id
      order by lower(account.email);
  end if;

  if not private.can_manage_task_access(p_resource_id) then raise exception 'Only the Task owner can view collaborator identities'; end if;
  return query
    select member.user_id, lower(account.email), member.role, member.granted_by, member.created_at, member.updated_at
    from public.task_collaborators member
    join auth.users account on account.id = member.user_id
    where member.task_id = p_resource_id
    order by lower(account.email);
end;
$$;

revoke all on function private.resolve_managed_resource_type(text, uuid) from public;
revoke all on function public.list_resource_collaborators(text, uuid) from public;
grant execute on function public.list_resource_collaborators(text, uuid) to authenticated;
notify pgrst, 'reload schema';
