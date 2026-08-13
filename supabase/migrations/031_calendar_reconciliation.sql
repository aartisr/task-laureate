-- Two-way calendar reconciliation.  A provider cursor is deliberately kept
-- separate from task blocks: providers differ in how they represent deltas,
-- but every adapter can advance an opaque cursor and hand owned changes to
-- this small, idempotent database boundary.

alter table public.calendar_task_blocks
  add column if not exists provider_updated_at timestamptz,
  add column if not exists last_reconciled_at timestamptz;

alter table public.calendar_task_blocks
  drop constraint if exists calendar_task_blocks_sync_state_check;
alter table public.calendar_task_blocks
  add constraint calendar_task_blocks_sync_state_check
  check (sync_state in ('active', 'reauthorization_required', 'error', 'removed_external'));

create table if not exists public.calendar_sync_cursors (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.calendar_provider_connections(id) on delete cascade,
  provider text not null check (provider in ('google_calendar')),
  calendar_id text not null check (char_length(calendar_id) between 1 and 1000),
  sync_token text,
  channel_id text,
  channel_resource_id text,
  channel_token_hash text,
  channel_expires_at timestamptz,
  last_message_number bigint not null default 0 check (last_message_number >= 0),
  last_synced_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(connection_id, provider, calendar_id)
);

create index if not exists calendar_sync_cursors_due_idx
  on public.calendar_sync_cursors(channel_expires_at, last_synced_at);

alter table public.calendar_sync_cursors enable row level security;

-- Only the service role may apply provider-originated deltas.  Browser-originated
-- scheduling continues through the owner-checked RPC in migration 030.
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
  if auth.role() <> 'service_role' then
    raise exception 'Calendar reconciliation is server-only';
  end if;
  if char_length(trim(coalesce(p_calendar_id, ''))) not between 1 and 1000
    or char_length(trim(coalesce(p_external_event_id, ''))) not between 1 and 1000
    or char_length(trim(coalesce(p_provider_revision, ''))) not between 1 and 1000 then
    raise exception 'Calendar reconciliation input is invalid';
  end if;

  select starts_at into previous_start from public.calendar_task_blocks
    where connection_id = p_connection_id and calendar_id = trim(p_calendar_id)
      and external_event_id = trim(p_external_event_id) for update;
  if not found then
    return null;
  end if;
  select owner_id into connection_owner from public.calendar_provider_connections
    where id = p_connection_id;

  if p_deleted then
    update public.calendar_task_blocks set
      sync_state = 'removed_external', external_event_url = null,
      provider_revision = trim(p_provider_revision), provider_updated_at = p_provider_updated_at,
      last_reconciled_at = timezone('utc', now()), last_error_code = null,
      updated_at = timezone('utc', now())
    where connection_id = p_connection_id and calendar_id = trim(p_calendar_id)
      and external_event_id = trim(p_external_event_id)
    returning * into saved;
    update public.task_planning_metadata set scheduled_start_at = null,
      updated_at = timezone('utc', now())
    where task_id = saved.task_id and scheduled_start_at = previous_start;
  else
    if p_starts_at is null or p_duration_minutes not between 5 and 1440 then
      raise exception 'Calendar event timing is invalid';
    end if;
    update public.calendar_task_blocks set
      starts_at = p_starts_at, duration_minutes = p_duration_minutes,
      external_event_url = nullif(trim(coalesce(p_external_event_url, '')), ''),
      provider_revision = trim(p_provider_revision), provider_updated_at = p_provider_updated_at,
      sync_state = 'active', last_reconciled_at = timezone('utc', now()),
      last_error_code = null, updated_at = timezone('utc', now())
    where connection_id = p_connection_id and calendar_id = trim(p_calendar_id)
      and external_event_id = trim(p_external_event_id)
    returning * into saved;
    update public.task_planning_metadata set scheduled_start_at = p_starts_at,
      updated_at = timezone('utc', now())
    where task_id = saved.task_id;
  end if;

  insert into public.task_events(task_id, actor_id, event_type, idempotency_key, payload)
  values (
    saved.task_id, connection_owner, 'scheduled',
    'calendar-reconcile:' || p_connection_id::text || ':' || trim(p_external_event_id) || ':' || trim(p_provider_revision),
    jsonb_build_object('provider', saved.provider, 'calendarId', p_calendar_id,
      'startsAt', p_starts_at, 'durationMinutes', p_duration_minutes, 'deleted', p_deleted)
  ) on conflict (idempotency_key) do nothing;
  return saved;
end;
$$;

grant execute on function public.reconcile_calendar_task_block(uuid, text, text, text, timestamptz, timestamptz, integer, text, boolean) to service_role;
revoke execute on function public.reconcile_calendar_task_block(uuid, text, text, text, timestamptz, timestamptz, integer, text, boolean) from public, anon, authenticated;

notify pgrst, 'reload schema';
