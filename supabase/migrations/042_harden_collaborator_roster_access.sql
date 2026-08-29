-- Authoritative collaborator-roster boundary.
--
-- The caller's verified PostgREST JWT identifies the owner; the resource UUID
-- identifies the List or Task. The browser-supplied resource label is retained
-- for the stable RPC contract but is deliberately not trusted for access.
-- List owners can also manage every Task contained by their List.
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
declare request_user_id uuid := coalesce(
  nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub',
  nullif(current_setting('request.jwt.claim.sub', true), ''),
  nullif(auth.jwt() ->> 'sub', '')
)::uuid;
begin
  if request_user_id is null then
    raise exception 'Sign in to view collaborator identities';
  end if;

  if exists (
    select 1
    from public.collaboration_lists list
    where list.id = p_resource_id
      and list.owner_id = request_user_id
  ) then
    return query
      select member.user_id, lower(account.email), member.role, member.granted_by, member.created_at, member.updated_at
      from public.list_collaborators member
      join auth.users account on account.id = member.user_id
      where member.list_id = p_resource_id
      order by lower(account.email);
    return;
  end if;

  if exists (
    select 1
    from public.collaboration_tasks task
    join public.collaboration_lists list on list.id = task.list_id
    where task.id = p_resource_id
      and (task.owner_id = request_user_id or list.owner_id = request_user_id)
  ) then
    return query
      select member.user_id, lower(account.email), member.role, member.granted_by, member.created_at, member.updated_at
      from public.task_collaborators member
      join auth.users account on account.id = member.user_id
      where member.task_id = p_resource_id
      order by lower(account.email);
    return;
  end if;

  raise exception 'Only the resource owner can view collaborator identities';
end;
$$;

revoke all on function public.list_resource_collaborators(text, uuid) from public;
grant execute on function public.list_resource_collaborators(text, uuid) to authenticated;
notify pgrst, 'reload schema';
