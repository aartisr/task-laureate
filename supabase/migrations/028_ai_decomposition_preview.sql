-- Durable, non-content controls for the opt-in AI decomposition preview.
-- The browser receives only narrow RPC capabilities; it cannot directly read
-- or alter another person's consent, quota, cache, or audit rows.

create table if not exists public.ai_decomposition_consents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  consent_version text not null check (char_length(consent_version) between 1 and 80),
  accepted_at timestamptz not null default timezone('utc', now()),
  revoked_at timestamptz
);

create table if not exists public.ai_decomposition_rate_windows (
  subject_type text not null check (subject_type in ('user', 'workspace', 'global')),
  subject_id text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  primary key (subject_type, subject_id, window_started_at)
);

create table if not exists public.ai_decomposition_cache (
  cache_key text primary key check (char_length(cache_key) = 64),
  owner_id uuid not null references auth.users(id) on delete cascade,
  proposal jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.ai_decomposition_audit_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.collaboration_tasks(id) on delete cascade,
  actor_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('requested', 'cache_hit', 'succeeded', 'fallback', 'schema_rejected', 'rate_limited', 'accepted', 'edited', 'discarded')),
  provider text,
  model text,
  prompt_version text,
  cache_status text check (cache_status is null or cache_status in ('hit', 'miss')),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  occurred_at timestamptz not null default timezone('utc', now())
);

create index if not exists ai_decomposition_cache_owner_expiry_idx on public.ai_decomposition_cache(owner_id, expires_at);
create index if not exists ai_decomposition_audit_actor_occurred_idx on public.ai_decomposition_audit_events(actor_id, occurred_at desc);

alter table public.ai_decomposition_consents enable row level security;
alter table public.ai_decomposition_rate_windows enable row level security;
alter table public.ai_decomposition_cache enable row level security;
alter table public.ai_decomposition_audit_events enable row level security;

create or replace function public.record_ai_decomposition_consent(p_consent_version text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in before accepting the AI preview terms'; end if;
  if char_length(trim(coalesce(p_consent_version, ''))) not between 1 and 80 then raise exception 'AI preview consent version is invalid'; end if;
  insert into public.ai_decomposition_consents(user_id, consent_version, accepted_at, revoked_at)
  values (auth.uid(), trim(p_consent_version), timezone('utc', now()), null)
  on conflict (user_id) do update set consent_version = excluded.consent_version, accepted_at = excluded.accepted_at, revoked_at = null;
end;
$$;

create or replace function public.get_ai_decomposition_task(p_task_id uuid, p_consent_version text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare task_row public.collaboration_tasks%rowtype;
declare consent_row public.ai_decomposition_consents%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign in before using the AI preview'; end if;
  if not private.can_read_task(p_task_id) then raise exception 'This Task is unavailable'; end if;
  select * into consent_row from public.ai_decomposition_consents where user_id = auth.uid() and revoked_at is null;
  if not found or consent_row.consent_version <> p_consent_version then raise exception 'AI preview consent is required'; end if;
  select * into task_row from public.collaboration_tasks where id = p_task_id and deleted_at is null;
  if not found then raise exception 'This Task is unavailable'; end if;
  return jsonb_build_object('taskId', task_row.id, 'title', task_row.title, 'notes', task_row.note_document);
end;
$$;

create or replace function public.reserve_ai_decomposition_request(p_task_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare workspace_id uuid;
declare hour_window timestamptz := date_trunc('hour', timezone('utc', now()));
declare day_window timestamptz := date_trunc('day', timezone('utc', now()));
declare user_count integer;
declare workspace_count integer;
declare global_count integer;
begin
  if auth.uid() is null or not private.can_read_task(p_task_id) then raise exception 'This Task is unavailable'; end if;
  select lists.workspace_id into workspace_id from public.collaboration_tasks tasks join public.collaboration_lists lists on lists.id = tasks.list_id where tasks.id = p_task_id;
  if workspace_id is null then raise exception 'This Task is unavailable'; end if;
  insert into public.ai_decomposition_rate_windows(subject_type, subject_id, window_started_at, request_count) values ('user', auth.uid()::text, hour_window, 1)
  on conflict (subject_type, subject_id, window_started_at) do update set request_count = public.ai_decomposition_rate_windows.request_count + 1
  returning request_count into user_count;
  if user_count > 3 then return false; end if;
  insert into public.ai_decomposition_rate_windows(subject_type, subject_id, window_started_at, request_count) values ('workspace', workspace_id::text, day_window, 1)
  on conflict (subject_type, subject_id, window_started_at) do update set request_count = public.ai_decomposition_rate_windows.request_count + 1
  returning request_count into workspace_count;
  if workspace_count > 20 then return false; end if;
  insert into public.ai_decomposition_rate_windows(subject_type, subject_id, window_started_at, request_count) values ('global', 'gemini-free-preview', day_window, 1)
  on conflict (subject_type, subject_id, window_started_at) do update set request_count = public.ai_decomposition_rate_windows.request_count + 1
  returning request_count into global_count;
  return global_count <= 100;
end;
$$;

create or replace function public.get_ai_decomposition_cache(p_cache_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare cached public.ai_decomposition_cache%rowtype;
begin
  if auth.uid() is null or p_cache_key !~ '^[a-f0-9]{64}$' then return null; end if;
  select * into cached from public.ai_decomposition_cache where cache_key = p_cache_key and owner_id = auth.uid() and expires_at > timezone('utc', now());
  return case when found then cached.proposal else null end;
end;
$$;

create or replace function public.put_ai_decomposition_cache(p_cache_key text, p_proposal jsonb, p_expires_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_cache_key !~ '^[a-f0-9]{64}$' or p_proposal is null or p_expires_at <= timezone('utc', now()) then raise exception 'AI preview cache input is invalid'; end if;
  insert into public.ai_decomposition_cache(cache_key, owner_id, proposal, expires_at) values (p_cache_key, auth.uid(), p_proposal, p_expires_at)
  on conflict (cache_key) do update set proposal = excluded.proposal, expires_at = excluded.expires_at where public.ai_decomposition_cache.owner_id = auth.uid();
end;
$$;

create or replace function public.record_ai_decomposition_event(p_task_id uuid, p_event_type text, p_provider text default null, p_model text default null, p_prompt_version text default null, p_cache_status text default null, p_latency_ms integer default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.can_read_task(p_task_id) then raise exception 'This Task is unavailable'; end if;
  insert into public.ai_decomposition_audit_events(task_id, actor_id, event_type, provider, model, prompt_version, cache_status, latency_ms)
  values (p_task_id, auth.uid(), p_event_type, nullif(trim(p_provider), ''), nullif(trim(p_model), ''), nullif(trim(p_prompt_version), ''), p_cache_status, p_latency_ms);
end;
$$;

grant execute on function public.record_ai_decomposition_consent(text) to authenticated;
grant execute on function public.get_ai_decomposition_task(uuid, text) to authenticated;
grant execute on function public.reserve_ai_decomposition_request(uuid) to authenticated;
grant execute on function public.get_ai_decomposition_cache(text) to authenticated;
grant execute on function public.put_ai_decomposition_cache(text, jsonb, timestamptz) to authenticated;
grant execute on function public.record_ai_decomposition_event(uuid, text, text, text, text, text, integer) to authenticated;

notify pgrst, 'reload schema';
