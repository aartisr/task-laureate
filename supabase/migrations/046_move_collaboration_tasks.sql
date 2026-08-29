-- Move a task atomically between editable active lists while retaining its ID and details.
create or replace function public.move_collaboration_task(p_task_id uuid, p_destination_list_id uuid)
returns public.collaboration_tasks
language plpgsql security definer set search_path = '' as $$
declare source_task public.collaboration_tasks; source_list public.collaboration_lists; destination_list public.collaboration_lists; moved_task public.collaboration_tasks;
begin
  select * into source_task from public.collaboration_tasks where id = p_task_id;
  if not found or not private.can_update_task(p_task_id) then raise exception 'You do not have permission to move this Task'; end if;
  select * into source_list from public.collaboration_lists where id = source_task.list_id;
  if not found or source_task.status = 'deleted' or source_list.status in ('archived', 'deleted') then raise exception 'Restore the Task and its current List before moving it'; end if;
  select * into destination_list from public.collaboration_lists where id = p_destination_list_id;
  if not found or destination_list.status in ('archived', 'deleted') or not private.can_update_tasks_in_list(p_destination_list_id) then raise exception 'Choose an active List you can edit'; end if;
  if source_task.list_id = p_destination_list_id then return source_task; end if;
  update public.collaboration_tasks set list_id = p_destination_list_id, owner_id = destination_list.owner_id, order_key = coalesce((select max(order_key) + 1 from public.collaboration_tasks where list_id = p_destination_list_id), 0) where id = p_task_id returning * into moved_task;
  return moved_task;
end;
$$;

-- Only the security-definer relocation RPC may change ownership or placement.
create or replace function private.protect_collaboration_task_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (new.owner_id <> old.owner_id or new.list_id <> old.list_id) and current_user <> 'postgres' then
    raise exception 'Task ownership and List placement are immutable outside the move operation';
  end if;
  new.version := old.version + 1; new.updated_at := timezone('utc', now());
  if new.status = 'done' and old.status <> 'done' then new.completed_at := new.updated_at; end if;
  if new.status <> 'done' then new.completed_at := null; end if;
  return new;
end;
$$;

revoke execute on function public.move_collaboration_task(uuid, uuid) from public, anon;
grant execute on function public.move_collaboration_task(uuid, uuid) to authenticated;
