-- A List is complete when it has at least one visible Task and every visible
-- Task is done. This must be enforced next to the Task data: the browser may
-- be offline, another collaborator may complete the final task, and older
-- workspaces can contain a stale active List whose progress is already 100%.
create or replace function private.reconcile_collaboration_list_lifecycle(p_list_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare list_row public.collaboration_lists%rowtype; has_visible_tasks boolean; has_open_tasks boolean;
begin
  select * into list_row from public.collaboration_lists where id = p_list_id for update;
  if not found or list_row.status in ('archived', 'deleted') then return; end if;

  select exists(select 1 from public.collaboration_tasks where list_id = p_list_id and status <> 'deleted'),
         exists(select 1 from public.collaboration_tasks where list_id = p_list_id and status not in ('done', 'deleted'))
    into has_visible_tasks, has_open_tasks;

  if list_row.status = 'active' and has_visible_tasks and not has_open_tasks then
    update public.collaboration_lists set status = 'completed' where id = p_list_id;
  elsif list_row.status = 'completed' and (not has_visible_tasks or has_open_tasks) then
    update public.collaboration_lists set status = 'active' where id = p_list_id;
  end if;
end;
$$;

create or replace function private.reconcile_list_lifecycle_after_task_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    perform private.reconcile_collaboration_list_lifecycle(old.list_id);
    return old;
  end if;

  perform private.reconcile_collaboration_list_lifecycle(new.list_id);
  if tg_op = 'UPDATE' and old.list_id <> new.list_id then
    perform private.reconcile_collaboration_list_lifecycle(old.list_id);
  end if;
  return new;
end;
$$;

drop trigger if exists reconcile_collaboration_list_lifecycle_after_task_change on public.collaboration_tasks;
create trigger reconcile_collaboration_list_lifecycle_after_task_change
after insert or update of status, list_id or delete on public.collaboration_tasks
for each row execute function private.reconcile_list_lifecycle_after_task_change();

-- Repair existing rows exactly once. It intentionally preserves archived and
-- deleted Lists, whose lifecycle is an explicit user decision.
select private.reconcile_collaboration_list_lifecycle(id)
from public.collaboration_lists
where status in ('active', 'completed');

notify pgrst, 'reload schema';
