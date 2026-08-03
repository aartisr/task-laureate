-- Harden task creation in the same way as List creation. Editors may create a
-- task in a List they can edit, while ownership remains with the List owner.
create or replace function public.create_collaboration_task(
  p_list_id uuid,
  p_title text,
  p_note_document text default '',
  p_priority text default 'medium',
  p_due_date date default null,
  p_tags text[] default '{}',
  p_order_key numeric default 0
) returns public.collaboration_tasks language plpgsql security definer set search_path = '' as $$
declare target_list public.collaboration_lists%rowtype;
declare created_task public.collaboration_tasks%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Sign in before creating a Task'; end if;
  if char_length(trim(coalesce(p_title, ''))) not between 1 and 500 then raise exception 'Task title must contain 1 to 500 characters'; end if;
  if char_length(coalesce(p_note_document, '')) > 250000 then raise exception 'Task note is too long'; end if;
  if p_priority not in ('low', 'medium', 'high', 'urgent') then raise exception 'Invalid task priority'; end if;

  select * into target_list from public.collaboration_lists where id = p_list_id;
  if not found or not private.can_update_tasks_in_list(p_list_id) then raise exception 'You do not have permission to add a Task to this List'; end if;

  insert into public.collaboration_tasks(list_id, owner_id, title, note_document, priority, due_date, tags, order_key)
  values (p_list_id, target_list.owner_id, trim(p_title), coalesce(p_note_document, ''), p_priority, p_due_date, coalesce(p_tags, '{}'), p_order_key)
  returning * into created_task;
  return created_task;
end;
$$;

grant select, insert, update, delete on public.collaboration_workspaces, public.collaboration_lists, public.collaboration_tasks to authenticated;
grant execute on function public.create_collaboration_task(uuid, text, text, text, date, text[], numeric) to authenticated;
