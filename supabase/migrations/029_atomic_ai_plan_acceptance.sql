-- A decomposition is accepted as one user decision. Persisting task_steps and
-- creating the visible child Tasks must therefore succeed or fail together.

create or replace function public.accept_task_plan(
  p_task_id uuid,
  p_steps jsonb,
  p_origin text default 'manual',
  p_idempotency_key text default null
) returns setof public.collaboration_tasks language plpgsql security definer set search_path = '' as $$
declare parent_task public.collaboration_tasks%rowtype;
declare step jsonb;
declare step_count integer;
begin
  if not private.can_update_task(p_task_id) then raise exception 'You do not have permission to add a plan to this Task'; end if;
  if p_origin not in ('manual', 'template', 'ai') then raise exception 'Plan origin is invalid'; end if;
  if jsonb_typeof(p_steps) <> 'array' or jsonb_array_length(p_steps) not between 1 and 20 then raise exception 'Provide between 1 and 20 task steps'; end if;
  select * into parent_task from public.collaboration_tasks where id = p_task_id and deleted_at is null;
  if not found or not private.can_update_tasks_in_list(parent_task.list_id) then raise exception 'The parent Task is unavailable or its List cannot be updated'; end if;
  if p_idempotency_key is not null and exists (select 1 from public.task_events where idempotency_key = p_idempotency_key) then
    return query select * from public.collaboration_tasks where list_id = parent_task.list_id and note_document = ('Next step for: ' || parent_task.title) order by created_at desc limit jsonb_array_length(p_steps);
    return;
  end if;
  step_count := jsonb_array_length(p_steps);
  for step in select * from jsonb_array_elements(p_steps)
  loop
    if char_length(trim(coalesce(step ->> 'title', ''))) not between 1 and 500 then raise exception 'Each step needs a title'; end if;
    if coalesce((step ->> 'estimateMinutes')::integer, 0) not between 1 and 1440 then raise exception 'Each step needs a valid estimate'; end if;
    if step ->> 'energyLevel' not in ('deep', 'light', 'quick') then raise exception 'Each step needs a valid energy level'; end if;
  end loop;
  insert into public.task_steps(task_id, title, estimate_minutes, energy_level, order_key, origin, accepted_at)
  select p_task_id, trim(entry.step ->> 'title'), (entry.step ->> 'estimateMinutes')::integer, entry.step ->> 'energyLevel', entry.ordinal::numeric, p_origin, timezone('utc', now())
  from jsonb_array_elements(p_steps) with ordinality as entry(step, ordinal);
  insert into public.collaboration_tasks(list_id, owner_id, title, note_document, order_key)
  select parent_task.list_id, parent_task.owner_id, trim(entry.step ->> 'title'), 'Next step for: ' || parent_task.title, extract(epoch from timezone('utc', now())) + entry.ordinal
  from jsonb_array_elements(p_steps) with ordinality as entry(step, ordinal);
  if p_idempotency_key is not null then
    insert into public.task_events(task_id, actor_id, event_type, idempotency_key, payload)
    values (p_task_id, auth.uid(), 'step_accepted', p_idempotency_key, jsonb_build_object('count', step_count, 'origin', p_origin));
  end if;
  return query select * from public.collaboration_tasks where list_id = parent_task.list_id and note_document = ('Next step for: ' || parent_task.title) order by created_at desc limit step_count;
end;
$$;

grant execute on function public.accept_task_plan(uuid, jsonb, text, text) to authenticated;
notify pgrst, 'reload schema';
