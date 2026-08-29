-- A calendar-owned duration is part of the task's scheduled plan. Keep the
-- planning read model aligned when a user resizes an owned Google event.

create or replace function public.reconcile_calendar_task_block(
  p_connection_id uuid,
  p_calendar_id text,
  p_external_event_id text,
  p_provider_revision text,
  p_provider_updated_at timestamptz,
  p_starts_at timestamptz,
  p_duration_minutes integer,
  p_external_event_url text,
  p_deleted boolean default false
) returns public.calendar_task_blocks language plpgsql security definer set search_path = '' as $$
declare
  saved public.calendar_task_blocks%rowtype;
  previous_start timestamptz;
  connection_owner uuid;
begin
  if auth.role() <> 'service_role' then raise exception 'Calendar reconciliation is server-only'; end if;
  if char_length(trim(coalesce(p_calendar_id, ''))) not between 1 and 1000
    or char_length(trim(coalesce(p_external_event_id, ''))) not between 1 and 1000
    or char_length(trim(coalesce(p_provider_revision, ''))) not between 1 and 1000 then
    raise exception 'Calendar reconciliation input is invalid';
  end if;
  select starts_at into previous_start from public.calendar_task_blocks
    where connection_id = p_connection_id and calendar_id = trim(p_calendar_id)
      and external_event_id = trim(p_external_event_id) for update;
  if not found then return null; end if;
  select owner_id into connection_owner from public.calendar_provider_connections where id = p_connection_id;

  if p_deleted then
    update public.calendar_task_blocks set sync_state = 'removed_external', external_event_url = null,
      provider_revision = trim(p_provider_revision), provider_updated_at = p_provider_updated_at,
      last_reconciled_at = timezone('utc', now()), last_error_code = null, updated_at = timezone('utc', now())
    where connection_id = p_connection_id and calendar_id = trim(p_calendar_id) and external_event_id = trim(p_external_event_id)
    returning * into saved;
    update public.task_planning_metadata set scheduled_start_at = null, updated_at = timezone('utc', now())
    where task_id = saved.task_id and scheduled_start_at = previous_start;
  else
    if p_starts_at is null or p_duration_minutes not between 5 and 1440 then raise exception 'Calendar event timing is invalid'; end if;
    update public.calendar_task_blocks set starts_at = p_starts_at, duration_minutes = p_duration_minutes,
      external_event_url = nullif(trim(coalesce(p_external_event_url, '')), ''), provider_revision = trim(p_provider_revision),
      provider_updated_at = p_provider_updated_at, sync_state = 'active', last_reconciled_at = timezone('utc', now()),
      last_error_code = null, updated_at = timezone('utc', now())
    where connection_id = p_connection_id and calendar_id = trim(p_calendar_id) and external_event_id = trim(p_external_event_id)
    returning * into saved;
    update public.task_planning_metadata set scheduled_start_at = p_starts_at, estimate_minutes = p_duration_minutes,
      updated_at = timezone('utc', now()) where task_id = saved.task_id;
  end if;
  insert into public.task_events(task_id, actor_id, event_type, idempotency_key, payload)
  values (saved.task_id, connection_owner, 'scheduled',
    'calendar-reconcile:' || p_connection_id::text || ':' || trim(p_external_event_id) || ':' || trim(p_provider_revision),
    jsonb_build_object('provider', saved.provider, 'calendarId', p_calendar_id, 'startsAt', p_starts_at, 'durationMinutes', p_duration_minutes, 'deleted', p_deleted))
  on conflict (idempotency_key) do nothing;
  return saved;
end;
$$;

notify pgrst, 'reload schema';
