-- Anti-backlog persistence foundation.
--
-- Planning and reflection are separate from collaboration_tasks so the core
-- task model remains portable. Every write uses a narrow RPC; direct table
-- writes are deliberately unavailable to browsers.

create table if not exists public.task_planning_metadata (
  task_id uuid primary key references public.collaboration_tasks(id) on delete cascade,
  estimate_minutes integer check (estimate_minutes is null or estimate_minutes between 1 and 1440),
  energy_level text check (energy_level is null or energy_level in ('deep', 'light', 'quick')),
  scheduled_start_at timestamptz,
  parent_task_id uuid references public.collaboration_tasks(id) on delete set null,
  needs_clarity boolean not null default true,
  updated_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (parent_task_id is null or parent_task_id <> task_id)
);

create table if not exists public.task_steps (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.collaboration_tasks(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 500),
  estimate_minutes integer not null check (estimate_minutes between 1 and 1440),
  energy_level text not null check (energy_level in ('deep', 'light', 'quick')),
  status text not null default 'todo' check (status in ('todo', 'doing', 'done', 'blocked')),
  order_key numeric(30, 12) not null,
  origin text not null default 'manual' check (origin in ('manual', 'template', 'ai')),
  accepted_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.task_capture_intents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  idempotency_key text not null unique check (char_length(idempotency_key) between 1 and 200),
  raw_input text not null check (char_length(raw_input) between 1 and 5000),
  parsed jsonb not null default '{}'::jsonb,
  parser_version text not null default 'deterministic-v1',
  resulting_task_id uuid references public.collaboration_tasks(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.task_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.collaboration_tasks(id) on delete cascade,
  actor_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  event_type text not null check (event_type in ('captured', 'planned', 'step_accepted', 'scheduled', 'completed', 'reopened', 'snoozed', 'parked', 'delegated', 'archived')),
  idempotency_key text not null unique check (char_length(idempotency_key) between 1 and 200),
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.task_calendar_links (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null unique references public.collaboration_tasks(id) on delete cascade,
  provider text not null check (provider in ('google_calendar', 'ical')),
  external_event_id text not null check (char_length(external_event_id) between 1 and 1000),
  provider_revision text not null check (char_length(provider_revision) between 1 and 1000),
  sync_state text not null default 'active' check (sync_state in ('active', 'conflict', 'disconnected')),
  linked_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(provider, external_event_id)
);

create index if not exists task_steps_task_order_idx on public.task_steps(task_id, order_key);
create index if not exists task_capture_intents_owner_created_idx on public.task_capture_intents(owner_id, created_at desc);
create index if not exists task_events_task_occurred_idx on public.task_events(task_id, occurred_at desc);
create index if not exists task_events_actor_occurred_idx on public.task_events(actor_id, occurred_at desc);
create index if not exists task_planning_recommendation_idx on public.task_planning_metadata(energy_level, estimate_minutes) where needs_clarity = false;

alter table public.task_planning_metadata enable row level security;
alter table public.task_steps enable row level security;
alter table public.task_capture_intents enable row level security;
alter table public.task_events enable row level security;
alter table public.task_calendar_links enable row level security;

create policy "authorized people read task planning" on public.task_planning_metadata for select to authenticated using (private.can_read_task(task_id));
create policy "authorized people read task steps" on public.task_steps for select to authenticated using (private.can_read_task(task_id));
create policy "owners read their capture intents" on public.task_capture_intents for select to authenticated using (owner_id = auth.uid());
create policy "authorized people read task events" on public.task_events for select to authenticated using (private.can_read_task(task_id));
create policy "authorized people read calendar links" on public.task_calendar_links for select to authenticated using (private.can_read_task(task_id));

create or replace function public.set_task_planning_metadata(
  p_task_id uuid,
  p_estimate_minutes integer default null,
  p_energy_level text default null,
  p_scheduled_start_at timestamptz default null,
  p_parent_task_id uuid default null
) returns public.task_planning_metadata language plpgsql security definer set search_path = '' as $$
declare saved public.task_planning_metadata%rowtype;
begin
  if not private.can_update_task(p_task_id) then raise exception 'You do not have permission to plan this Task'; end if;
  if p_estimate_minutes is not null and p_estimate_minutes not between 1 and 1440 then raise exception 'Estimate must be between 1 and 1440 minutes'; end if;
  if p_energy_level is not null and p_energy_level not in ('deep', 'light', 'quick') then raise exception 'Energy level is invalid'; end if;
  if p_parent_task_id = p_task_id then raise exception 'A task cannot be its own parent'; end if;
  if p_parent_task_id is not null and not private.can_read_task(p_parent_task_id) then raise exception 'Parent task is unavailable'; end if;
  insert into public.task_planning_metadata(task_id, estimate_minutes, energy_level, scheduled_start_at, parent_task_id, needs_clarity, updated_by)
  values (p_task_id, p_estimate_minutes, p_energy_level, p_scheduled_start_at, p_parent_task_id, p_estimate_minutes is null or p_energy_level is null, auth.uid())
  on conflict (task_id) do update set estimate_minutes = excluded.estimate_minutes, energy_level = excluded.energy_level,
    scheduled_start_at = excluded.scheduled_start_at, parent_task_id = excluded.parent_task_id,
    needs_clarity = excluded.needs_clarity, updated_by = auth.uid(), updated_at = timezone('utc', now())
  returning * into saved;
  return saved;
end;
$$;

create or replace function public.accept_task_steps(
  p_task_id uuid,
  p_steps jsonb,
  p_origin text default 'manual',
  p_idempotency_key text default null
) returns setof public.task_steps language plpgsql security definer set search_path = '' as $$
declare step jsonb;
declare step_count integer;
begin
  if not private.can_update_task(p_task_id) then raise exception 'You do not have permission to add task steps'; end if;
  if p_origin not in ('manual', 'template', 'ai') then raise exception 'Step origin is invalid'; end if;
  if jsonb_typeof(p_steps) <> 'array' or jsonb_array_length(p_steps) not between 1 and 20 then raise exception 'Provide between 1 and 20 task steps'; end if;
  step_count := jsonb_array_length(p_steps);
  if p_idempotency_key is not null and exists (select 1 from public.task_events where idempotency_key = p_idempotency_key) then
    return query select * from public.task_steps where task_id = p_task_id order by order_key;
    return;
  end if;
  for step in select * from jsonb_array_elements(p_steps)
  loop
    if char_length(trim(coalesce(step ->> 'title', ''))) not between 1 and 500 then raise exception 'Step title must contain 1 to 500 characters'; end if;
    if coalesce((step ->> 'estimateMinutes')::integer, 0) not between 1 and 1440 then raise exception 'Step estimate must be between 1 and 1440 minutes'; end if;
    if step ->> 'energyLevel' not in ('deep', 'light', 'quick') then raise exception 'Step energy level is invalid'; end if;
  end loop;
  insert into public.task_steps(task_id, title, estimate_minutes, energy_level, order_key, origin, accepted_at)
  select p_task_id, trim(step ->> 'title'), (step ->> 'estimateMinutes')::integer, step ->> 'energyLevel', ordinal::numeric, p_origin, timezone('utc', now())
  from jsonb_array_elements(p_steps) with ordinality as entries(step, ordinal);
  if p_idempotency_key is not null then
    insert into public.task_events(task_id, event_type, idempotency_key, payload)
    values (p_task_id, 'step_accepted', p_idempotency_key, jsonb_build_object('count', step_count, 'origin', p_origin));
  end if;
  return query select * from public.task_steps where task_id = p_task_id order by order_key;
end;
$$;

create or replace function public.record_task_capture_intent(
  p_idempotency_key text,
  p_raw_input text,
  p_parsed jsonb,
  p_parser_version text default 'deterministic-v1'
) returns public.task_capture_intents language plpgsql security definer set search_path = '' as $$
declare saved public.task_capture_intents%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign in before saving a capture'; end if;
  insert into public.task_capture_intents(owner_id, idempotency_key, raw_input, parsed, parser_version)
  values (auth.uid(), p_idempotency_key, p_raw_input, coalesce(p_parsed, '{}'::jsonb), p_parser_version)
  on conflict (idempotency_key) do update set idempotency_key = excluded.idempotency_key
  returning * into saved;
  return saved;
end;
$$;

create or replace function public.record_task_event(
  p_task_id uuid,
  p_event_type text,
  p_idempotency_key text,
  p_payload jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_update_task(p_task_id) then raise exception 'You do not have permission to record this task event'; end if;
  insert into public.task_events(task_id, actor_id, event_type, idempotency_key, payload)
  values (p_task_id, auth.uid(), p_event_type, p_idempotency_key, coalesce(p_payload, '{}'::jsonb)) on conflict (idempotency_key) do nothing;
end;
$$;

grant select on public.task_planning_metadata, public.task_steps, public.task_capture_intents, public.task_events, public.task_calendar_links to authenticated;
grant execute on function public.set_task_planning_metadata(uuid, integer, text, timestamptz, uuid) to authenticated;
grant execute on function public.accept_task_steps(uuid, jsonb, text, text) to authenticated;
grant execute on function public.record_task_capture_intent(text, text, jsonb, text) to authenticated;
grant execute on function public.record_task_event(uuid, text, text, jsonb) to authenticated;

notify pgrst, 'reload schema';
