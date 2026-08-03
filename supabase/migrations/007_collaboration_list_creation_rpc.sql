-- Harden the creation boundary. A browser never chooses a List owner or
-- workspace; the database derives both from the authenticated identity.
create or replace function public.create_collaboration_list(p_title text, p_description text default '')
returns public.collaboration_lists language plpgsql security definer set search_path = '' as $$
declare workspace public.collaboration_workspaces%rowtype;
declare created_list public.collaboration_lists%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Sign in before creating a List'; end if;
  if char_length(trim(coalesce(p_title, ''))) not between 1 and 500 then raise exception 'List title must contain 1 to 500 characters'; end if;
  if char_length(coalesce(p_description, '')) > 10000 then raise exception 'List description is too long'; end if;

  select * into workspace from public.collaboration_workspaces
  where owner_id = (select auth.uid()) order by created_at asc limit 1;
  if not found then
    insert into public.collaboration_workspaces(owner_id, name)
    values ((select auth.uid()), 'My workspace')
    returning * into workspace;
  end if;

  insert into public.collaboration_lists(workspace_id, owner_id, title, description)
  values (workspace.id, (select auth.uid()), trim(p_title), coalesce(p_description, ''))
  returning * into created_list;
  return created_list;
end;
$$;

-- Reassert the minimum Data API permissions in case early manual setup created
-- the tables and policies but omitted the grants.
grant select, insert, update, delete on public.collaboration_workspaces, public.collaboration_lists, public.collaboration_tasks to authenticated;
grant select on public.list_collaborators, public.task_collaborators, public.share_invitations to authenticated;
grant execute on function public.ensure_collaboration_workspace(text) to authenticated;
grant execute on function public.create_collaboration_list(text, text) to authenticated;
