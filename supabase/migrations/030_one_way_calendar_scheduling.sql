-- One-way calendar scheduling: Task-Laureate creates, updates, and removes
-- only the blocks it owns. Provider-originated edits are intentionally never
-- imported here; two-way reconciliation is a separate future capability.

create table if not exists public.calendar_provider_connections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('google_calendar')),
  encrypted_refresh_token text not null check (char_length(encrypted_refresh_token) between 24 and 10000),
  scopes text[] not null default '{}',
  default_calendar_id text not null default 'primary' check (char_length(default_calendar_id) between 1 and 1000),
  status text not null default 'active' check (status in ('active', 'reauthorization_required', 'disconnected')),
  connected_at timestamptz not null default timezone('utc', now()),
  last_used_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(owner_id, provider)
);

create table if not exists public.calendar_task_blocks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.collaboration_tasks(id) on delete cascade,
  connection_id uuid not null references public.calendar_provider_connections(id) on delete cascade,
  provider text not null check (provider in ('google_calendar')),
  calendar_id text not null check (char_length(calendar_id) between 1 and 1000),
  external_event_id text not null check (char_length(external_event_id) between 1 and 1000),
  external_event_url text,
  provider_revision text not null check (char_length(provider_revision) between 1 and 1000),
  starts_at timestamptz not null,
  duration_minutes integer not null check (duration_minutes between 5 and 1440),
  sync_state text not null default 'active' check (sync_state in ('active', 'reauthorization_required', 'error')),
  last_error_code text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(task_id, connection_id),
  unique(provider, calendar_id, external_event_id)
);

create index if not exists calendar_provider_connections_owner_idx on public.calendar_provider_connections(owner_id, provider);
create index if not exists calendar_task_blocks_connection_idx on public.calendar_task_blocks(connection_id, updated_at desc);

alter table public.calendar_provider_connections enable row level security;
alter table public.calendar_task_blocks enable row level security;

-- Only the minimal, non-token scheduling information is readable to people who
-- can read a Task. Tokens stay server-only with no browser table policy.
create policy "authorized people read calendar task blocks" on public.calendar_task_blocks
  for select to authenticated using (private.can_read_task(task_id));

create or replace function public.get_calendar_schedule_task(p_task_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare task_row public.collaboration_tasks%rowtype;
declare list_title text;
declare planning public.task_planning_metadata%rowtype;
begin
  if auth.uid() is null or not private.can_update_task(p_task_id) then raise exception 'You do not have permission to schedule this Task'; end if;
  select * into task_row from public.collaboration_tasks where id = p_task_id and deleted_at is null;
  if not found then raise exception 'This Task is unavailable'; end if;
  select title into list_title from public.collaboration_lists where id = task_row.list_id;
  select * into planning from public.task_planning_metadata where task_id = p_task_id;
  return jsonb_build_object(
    'taskId', task_row.id,
    'title', task_row.title,
    'listTitle', coalesce(list_title, 'Task-Laureate'),
    'estimateMinutes', planning.estimate_minutes,
    'scheduledStartAt', planning.scheduled_start_at
  );
end;
$$;

create or replace function public.record_calendar_task_block(
  p_task_id uuid,
  p_connection_id uuid,
  p_provider text,
  p_calendar_id text,
  p_external_event_id text,
  p_external_event_url text,
  p_provider_revision text,
  p_starts_at timestamptz,
  p_duration_minutes integer
) returns public.calendar_task_blocks language plpgsql security definer set search_path = '' as $$
declare saved public.calendar_task_blocks%rowtype;
declare existing_estimate integer;
begin
  if auth.uid() is null or not private.can_update_task(p_task_id) then raise exception 'You do not have permission to schedule this Task'; end if;
  if p_provider <> 'google_calendar' or char_length(trim(coalesce(p_calendar_id, ''))) not between 1 and 1000 or char_length(trim(coalesce(p_external_event_id, ''))) not between 1 and 1000 or char_length(trim(coalesce(p_provider_revision, ''))) not between 1 and 1000 or p_duration_minutes not between 5 and 1440 then raise exception 'Calendar block input is invalid'; end if;
  if not exists (select 1 from public.calendar_provider_connections where id = p_connection_id and owner_id = auth.uid() and provider = p_provider and status = 'active') then raise exception 'Calendar connection is unavailable'; end if;
  insert into public.calendar_task_blocks(task_id, connection_id, provider, calendar_id, external_event_id, external_event_url, provider_revision, starts_at, duration_minutes)
  values (p_task_id, p_connection_id, p_provider, trim(p_calendar_id), trim(p_external_event_id), nullif(trim(coalesce(p_external_event_url, '')), ''), trim(p_provider_revision), p_starts_at, p_duration_minutes)
  on conflict (task_id, connection_id) do update set calendar_id = excluded.calendar_id, external_event_id = excluded.external_event_id, external_event_url = excluded.external_event_url, provider_revision = excluded.provider_revision, starts_at = excluded.starts_at, duration_minutes = excluded.duration_minutes, sync_state = 'active', last_error_code = null, updated_at = timezone('utc', now())
  returning * into saved;
  select estimate_minutes into existing_estimate from public.task_planning_metadata where task_id = p_task_id;
  insert into public.task_planning_metadata(task_id, estimate_minutes, scheduled_start_at, needs_clarity, updated_by)
  values (p_task_id, coalesce(existing_estimate, p_duration_minutes), p_starts_at, existing_estimate is null, auth.uid())
  on conflict (task_id) do update set scheduled_start_at = excluded.scheduled_start_at, estimate_minutes = coalesce(public.task_planning_metadata.estimate_minutes, excluded.estimate_minutes), needs_clarity = public.task_planning_metadata.energy_level is null or coalesce(public.task_planning_metadata.estimate_minutes, excluded.estimate_minutes) is null, updated_by = auth.uid(), updated_at = timezone('utc', now());
  insert into public.task_events(task_id, actor_id, event_type, idempotency_key, payload)
  values (p_task_id, auth.uid(), 'scheduled', 'calendar:' || p_connection_id::text || ':' || p_task_id::text || ':' || p_provider_revision, jsonb_build_object('provider', p_provider, 'calendarId', p_calendar_id, 'startsAt', p_starts_at, 'durationMinutes', p_duration_minutes))
  on conflict (idempotency_key) do nothing;
  return saved;
end;
$$;

create or replace function public.remove_calendar_task_block(p_task_id uuid, p_connection_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.can_update_task(p_task_id) then raise exception 'You do not have permission to remove this calendar block'; end if;
  delete from public.calendar_task_blocks blocks using public.calendar_provider_connections connections
  where blocks.task_id = p_task_id and blocks.connection_id = p_connection_id and connections.id = blocks.connection_id and connections.owner_id = auth.uid();
end;
$$;

grant select on public.calendar_task_blocks to authenticated;
grant execute on function public.get_calendar_schedule_task(uuid) to authenticated;
grant execute on function public.record_calendar_task_block(uuid, uuid, text, text, text, text, text, timestamptz, integer) to authenticated;
grant execute on function public.remove_calendar_task_block(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
