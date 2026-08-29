-- Atomic, idempotent capture delivery. A capture is never duplicated if the
-- client retries after a dropped connection: the durable intent is the key.

create or replace function public.capture_task(
  p_idempotency_key text,
  p_raw_input text,
  p_parsed jsonb,
  p_list_id uuid default null
) returns public.collaboration_tasks language plpgsql security definer set search_path = '' as $$
declare target_list public.collaboration_lists%rowtype;
declare captured_task public.collaboration_tasks%rowtype;
declare existing_intent public.task_capture_intents%rowtype;
declare workspace public.collaboration_workspaces%rowtype;
declare parsed_title text;
declare parsed_tags text[];
declare parsed_estimate integer;
declare parsed_schedule timestamptz;
begin
  if auth.uid() is null then raise exception 'Sign in before capturing a task'; end if;
  if char_length(trim(coalesce(p_raw_input, ''))) not between 1 and 5000 then raise exception 'Capture must contain 1 to 5000 characters'; end if;
  parsed_title := trim(coalesce(p_parsed ->> 'title', ''));
  if char_length(parsed_title) not between 1 and 500 then raise exception 'Capture title must contain 1 to 500 characters'; end if;
  select * into existing_intent from public.task_capture_intents where idempotency_key = p_idempotency_key;
  if found then
    if existing_intent.owner_id <> auth.uid() then raise exception 'Capture idempotency key is unavailable'; end if;
    if existing_intent.resulting_task_id is null then raise exception 'Capture is already being processed'; end if;
    select * into captured_task from public.collaboration_tasks where id = existing_intent.resulting_task_id;
    return captured_task;
  end if;

  if p_list_id is not null then
    if not private.can_update_tasks_in_list(p_list_id) then raise exception 'You do not have permission to capture into this List'; end if;
    select * into target_list from public.collaboration_lists where id = p_list_id;
  else
    select * into target_list from public.collaboration_lists
    where owner_id = auth.uid() and title = 'Inbox' and status = 'active' and deleted_at is null
    order by created_at asc limit 1;
    if not found then
      select * into workspace from public.collaboration_workspaces where owner_id = auth.uid() order by created_at asc limit 1;
      if not found then
        insert into public.collaboration_workspaces(owner_id, name) values (auth.uid(), 'My workspace') returning * into workspace;
      end if;
      insert into public.collaboration_lists(workspace_id, owner_id, title, description)
      values (workspace.id, auth.uid(), 'Inbox', 'Fast capture inbox') returning * into target_list;
    end if;
  end if;

  select coalesce(array_agg(value), '{}') into parsed_tags
  from jsonb_array_elements_text(coalesce(p_parsed -> 'tags', '[]'::jsonb)) as value;
  parsed_estimate := nullif(p_parsed ->> 'estimateMinutes', '')::integer;
  if parsed_estimate is not null and parsed_estimate not between 1 and 1440 then parsed_estimate := null; end if;
  parsed_schedule := nullif(p_parsed ->> 'scheduledStartAt', '')::timestamptz;

  insert into public.task_capture_intents(owner_id, idempotency_key, raw_input, parsed)
  values (auth.uid(), p_idempotency_key, p_raw_input, coalesce(p_parsed, '{}'::jsonb)) returning * into existing_intent;
  insert into public.collaboration_tasks(list_id, owner_id, title, tags, order_key)
  values (target_list.id, target_list.owner_id, parsed_title, parsed_tags, extract(epoch from timezone('utc', now())))
  returning * into captured_task;
  insert into public.task_planning_metadata(task_id, estimate_minutes, energy_level, scheduled_start_at, needs_clarity, updated_by)
  values (captured_task.id, parsed_estimate, null, parsed_schedule, true, auth.uid());
  update public.task_capture_intents set resulting_task_id = captured_task.id where id = existing_intent.id;
  insert into public.task_events(task_id, actor_id, event_type, idempotency_key, payload)
  values (captured_task.id, auth.uid(), 'captured', 'capture-event:' || p_idempotency_key, jsonb_build_object('intentId', existing_intent.id));
  return captured_task;
end;
$$;

grant execute on function public.capture_task(text, text, jsonb, uuid) to authenticated;
notify pgrst, 'reload schema';
