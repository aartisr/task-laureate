-- Treat the roster RPC as a durable boundary between browser releases and the
-- database. Older clients can preserve casing or whitespace in a resource
-- type; normalizing it here prevents a non-essential roster read from making
-- the Share Task experience fail.
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
declare normalized_resource_type text := lower(trim(coalesce(p_resource_type, '')));
begin
  if normalized_resource_type = 'list' then
    if not private.can_manage_list_access(p_resource_id) then raise exception 'Only the List owner can view collaborator identities'; end if;
    return query
      select member.user_id, lower(account.email), member.role, member.granted_by, member.created_at, member.updated_at
      from public.list_collaborators member
      join auth.users account on account.id = member.user_id
      where member.list_id = p_resource_id
      order by lower(account.email);
  elsif normalized_resource_type = 'task' then
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

revoke all on function public.list_resource_collaborators(text, uuid) from public;
grant execute on function public.list_resource_collaborators(text, uuid) to authenticated;
notify pgrst, 'reload schema';
