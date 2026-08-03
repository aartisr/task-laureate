-- Intentional early-stage reset: the legacy JSON snapshot store cannot enforce
-- resource-level sharing. This removes its data and schema, but never auth.users.
drop table if exists public.workspace_snapshots;

alter table public.collaboration_lists alter column owner_id set default auth.uid();
alter table public.collaboration_tasks alter column owner_id set default auth.uid();

-- List editors may create tasks, but those tasks remain owned by the List owner
-- so an editor cannot gain sharing authority merely by creating a task.
create or replace function private.assign_collaboration_task_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select owner_id into new.owner_id from public.collaboration_lists where id = new.list_id;
  if new.owner_id is null then raise exception 'List not found'; end if;
  return new;
end;
$$;

drop trigger if exists assign_collaboration_task_owner on public.collaboration_tasks;
create trigger assign_collaboration_task_owner
before insert on public.collaboration_tasks
for each row execute function private.assign_collaboration_task_owner();

-- One private normalized workspace per account. Keeping its creation in an RPC
-- lets a browser initialize idempotently without broad table permissions.
create or replace function public.ensure_collaboration_workspace(p_name text default 'My workspace')
returns public.collaboration_workspaces language plpgsql security definer set search_path = '' as $$
declare workspace public.collaboration_workspaces%rowtype;
begin
  select * into workspace from public.collaboration_workspaces
  where owner_id = (select auth.uid()) order by created_at asc limit 1;
  if found then return workspace; end if;
  insert into public.collaboration_workspaces(owner_id, name)
  values ((select auth.uid()), left(coalesce(nullif(trim(p_name), ''), 'My workspace'), 250))
  returning * into workspace;
  return workspace;
end;
$$;

grant execute on function public.ensure_collaboration_workspace(text) to authenticated;
