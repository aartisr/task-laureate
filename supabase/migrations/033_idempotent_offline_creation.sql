-- Durable clients may retry after a response is lost. Record the actor's
-- idempotency key before returning so create commands remain exactly-once from
-- the product's point of view.
create table if not exists public.remote_mutation_receipts (
  owner_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null check (char_length(trim(idempotency_key)) between 1 and 200),
  resource_type text not null check (resource_type in ('list', 'task')),
  resource_id uuid not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (owner_id, idempotency_key)
);

alter table public.remote_mutation_receipts enable row level security;

drop function if exists public.create_collaboration_list(text, text);
create function public.create_collaboration_list(p_title text, p_description text default '', p_idempotency_key text default null)
returns public.collaboration_lists language plpgsql security definer set search_path = '' as $$
declare workspace public.collaboration_workspaces%rowtype; created_list public.collaboration_lists%rowtype; existing_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in before creating a List'; end if;
  if char_length(trim(coalesce(p_title, ''))) not between 1 and 500 then raise exception 'List title must contain 1 to 500 characters'; end if;
  if char_length(coalesce(p_description, '')) > 10000 then raise exception 'List description is too long'; end if;
  if p_idempotency_key is not null then
    select resource_id into existing_id from public.remote_mutation_receipts where owner_id = auth.uid() and idempotency_key = trim(p_idempotency_key);
    if found then return (select list from public.collaboration_lists list where list.id = existing_id); end if;
  end if;
  select * into workspace from public.collaboration_workspaces where owner_id = auth.uid() order by created_at asc limit 1;
  if not found then insert into public.collaboration_workspaces(owner_id, name) values (auth.uid(), 'My workspace') returning * into workspace; end if;
  insert into public.collaboration_lists(workspace_id, owner_id, title, description) values (workspace.id, auth.uid(), trim(p_title), coalesce(p_description, '')) returning * into created_list;
  if p_idempotency_key is not null then insert into public.remote_mutation_receipts(owner_id, idempotency_key, resource_type, resource_id) values (auth.uid(), trim(p_idempotency_key), 'list', created_list.id); end if;
  return created_list;
end; $$;

drop function if exists public.create_collaboration_task(uuid, text, text, text, date, text[], numeric);
create function public.create_collaboration_task(p_list_id uuid, p_title text, p_note_document text default '', p_priority text default 'medium', p_due_date date default null, p_tags text[] default '{}', p_order_key numeric default 0, p_idempotency_key text default null)
returns public.collaboration_tasks language plpgsql security definer set search_path = '' as $$
declare target_list public.collaboration_lists%rowtype; created_task public.collaboration_tasks%rowtype; existing_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in before creating a Task'; end if;
  if char_length(trim(coalesce(p_title, ''))) not between 1 and 500 then raise exception 'Task title must contain 1 to 500 characters'; end if;
  if char_length(coalesce(p_note_document, '')) > 250000 then raise exception 'Task note is too long'; end if;
  if p_priority not in ('low', 'medium', 'high', 'urgent') then raise exception 'Invalid task priority'; end if;
  if p_idempotency_key is not null then select resource_id into existing_id from public.remote_mutation_receipts where owner_id = auth.uid() and idempotency_key = trim(p_idempotency_key); if found then return (select task from public.collaboration_tasks task where task.id = existing_id); end if; end if;
  select * into target_list from public.collaboration_lists where id = p_list_id;
  if not found or not private.can_update_tasks_in_list(p_list_id) then raise exception 'You do not have permission to add a Task to this List'; end if;
  insert into public.collaboration_tasks(list_id, owner_id, title, note_document, priority, due_date, tags, order_key) values (p_list_id, target_list.owner_id, trim(p_title), coalesce(p_note_document, ''), p_priority, p_due_date, coalesce(p_tags, '{}'), p_order_key) returning * into created_task;
  if p_idempotency_key is not null then insert into public.remote_mutation_receipts(owner_id, idempotency_key, resource_type, resource_id) values (auth.uid(), trim(p_idempotency_key), 'task', created_task.id); end if;
  return created_task;
end; $$;

grant execute on function public.create_collaboration_list(text, text, text) to authenticated;
grant execute on function public.create_collaboration_task(uuid, text, text, text, date, text[], numeric, text) to authenticated;
notify pgrst, 'reload schema';
