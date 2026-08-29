-- Assignment-aware reminders for normalized collaboration data.
--
-- The browser may configure work, but it never gets access to delivery
-- credentials or a recipient's private delivery address. The cron endpoint
-- calls claim_due_task_reminders(), which atomically records an idempotency
-- key before any external provider is contacted.

create table if not exists public.task_assignments (
  task_id uuid not null references public.collaboration_tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  assigned_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (task_id, user_id)
);

create index if not exists task_assignments_user_task_idx on public.task_assignments(user_id, task_id);

create table if not exists public.task_reminder_rules (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null unique references public.collaboration_tasks(id) on delete cascade,
  offset_minutes integer not null default 1440 check (offset_minutes between 0 and 43200),
  channels text[] not null default array['in_app']::text[] check (cardinality(channels) between 1 and 3),
  enabled boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists task_reminder_rules_enabled_idx on public.task_reminder_rules(task_id) where enabled;
create index if not exists collaboration_tasks_due_active_idx on public.collaboration_tasks(due_date, id) where status not in ('done', 'deleted') and due_date is not null;

-- Delivery records are private operational data. A unique event key is the
-- retry boundary: inserting it first makes cron retries and overlapping runs safe.
create table if not exists public.task_reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  task_id uuid not null references public.collaboration_tasks(id) on delete cascade,
  rule_id uuid not null references public.task_reminder_rules(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  channel text not null check (channel in ('in_app', 'email', 'sms')),
  status text not null default 'pending' check (status in ('pending', 'sent', 'skipped', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  provider_message_id text,
  last_error text,
  scheduled_for timestamptz not null,
  delivered_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists task_reminder_deliveries_pending_idx on public.task_reminder_deliveries(status, scheduled_for) where status in ('pending', 'failed');
create index if not exists task_reminder_deliveries_recipient_idx on public.task_reminder_deliveries(recipient_id, created_at desc);

alter table public.notification_preferences
  add column if not exists email_reminders boolean not null default true,
  add column if not exists sms_reminders boolean not null default false,
  add column if not exists phone_e164 text,
  add column if not exists sms_opted_in_at timestamptz,
  add column if not exists time_zone text not null default 'UTC';

alter table public.notification_events drop constraint if exists notification_events_kind_check;
alter table public.notification_events add constraint notification_events_kind_check
  check (kind in ('due_soon', 'weekly_digest', 'task_assigned', 'task_reminder'));

alter table public.task_assignments enable row level security;
alter table public.task_reminder_rules enable row level security;
alter table public.task_reminder_deliveries enable row level security;

create policy "authorized people read task assignments" on public.task_assignments
  for select to authenticated using ((select private.can_read_task(task_id)) or user_id = (select auth.uid()));
create policy "owners read reminder rules" on public.task_reminder_rules
  for select to authenticated using ((select private.can_manage_task_access(task_id)));
create policy "recipients read own reminder deliveries" on public.task_reminder_deliveries
  for select to authenticated using (recipient_id = (select auth.uid()));

create or replace function private.is_eligible_task_assignee(target_task_id uuid, target_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.collaboration_tasks task
    join public.collaboration_lists list on list.id = task.list_id
    where task.id = target_task_id and (
      list.owner_id = target_user_id
      or exists (select 1 from public.list_collaborators member where member.list_id = task.list_id and member.user_id = target_user_id)
      or exists (select 1 from public.task_collaborators member where member.task_id = task.id and member.user_id = target_user_id)
    )
  );
$$;

create or replace function public.set_task_assignment(p_task_id uuid, p_user_id uuid, p_assigned boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_manage_task_access(p_task_id) then
    raise exception 'Only the Task owner can manage assignees';
  end if;
  if p_assigned and not private.is_eligible_task_assignee(p_task_id, p_user_id) then
    raise exception 'A task can only be assigned to a person who already has access';
  end if;
  if p_assigned then
    insert into public.task_assignments(task_id, user_id, assigned_by)
    values (p_task_id, p_user_id, (select auth.uid())) on conflict do nothing;
    insert into public.notification_events(owner_id, event_key, kind, title, body)
    select p_user_id, 'task-assigned:' || p_task_id::text, 'task_assigned', 'You were assigned a task', left(task.title, 1000)
    from public.collaboration_tasks task where task.id = p_task_id
    on conflict (owner_id, event_key) do nothing;
  else
    delete from public.task_assignments where task_id = p_task_id and user_id = p_user_id;
  end if;
end;
$$;

create or replace function public.configure_task_reminder(
  p_task_id uuid,
  p_enabled boolean,
  p_offset_minutes integer default 1440,
  p_channels text[] default array['in_app']::text[]
) returns public.task_reminder_rules language plpgsql security definer set search_path = '' as $$
declare configured public.task_reminder_rules%rowtype;
begin
  if not private.can_manage_task_access(p_task_id) then raise exception 'Only the Task owner can configure reminders'; end if;
  if p_offset_minutes < 0 or p_offset_minutes > 43200 then raise exception 'Reminder offset must be between 0 minutes and 30 days'; end if;
  if cardinality(p_channels) is null or cardinality(p_channels) < 1 or cardinality(p_channels) > 3
    or exists (select 1 from unnest(p_channels) channel where channel not in ('in_app', 'email', 'sms')) then
    raise exception 'Reminder channels are invalid';
  end if;
  insert into public.task_reminder_rules(task_id, enabled, offset_minutes, channels, created_by)
  values (p_task_id, p_enabled, p_offset_minutes, p_channels, (select auth.uid()))
  on conflict (task_id) do update set enabled = excluded.enabled, offset_minutes = excluded.offset_minutes,
    channels = excluded.channels, updated_at = timezone('utc', now())
  returning * into configured;
  return configured;
end;
$$;

create or replace function public.list_task_assignment_candidates(p_task_id uuid)
returns table (user_id uuid, access_role text) language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_manage_task_access(p_task_id) then raise exception 'Only the Task owner can view assignee candidates'; end if;
  return query
  select candidate.user_id, min(candidate.access_role) from (
    select list.owner_id as user_id, 'owner'::text as access_role
    from public.collaboration_tasks task join public.collaboration_lists list on list.id = task.list_id where task.id = p_task_id
    union all
    select member.user_id, member.role from public.collaboration_tasks task join public.list_collaborators member on member.list_id = task.list_id where task.id = p_task_id
    union all
    select member.user_id, member.role from public.task_collaborators member where member.task_id = p_task_id
  ) candidate group by candidate.user_id order by min(candidate.access_role), candidate.user_id;
end;
$$;

-- Service-role-only atomic work queue. Invalid recipient timezone values safely
-- fall back to UTC; one malformed preference cannot stop all reminders.
drop function if exists public.claim_due_task_reminders(timestamptz);
create function public.claim_due_task_reminders(p_now timestamptz default timezone('utc', now()), p_limit integer default 80)
returns table (
  delivery_id uuid, event_key text, task_id uuid, recipient_id uuid, channel text,
  task_title text, list_title text, due_date date, scheduled_for timestamptz, in_app_enabled boolean, email_enabled boolean,
  sms_enabled boolean, phone_e164 text, sms_opted_in_at timestamptz
) language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then raise exception 'Service role required'; end if;
  if p_limit < 1 or p_limit > 250 then raise exception 'Claim limit must be between 1 and 250'; end if;
  return query
  with candidates as (
    select rule.id as rule_id, task.id as candidate_task_id, assignment.user_id as candidate_recipient_id,
      channel.value as candidate_channel, task.title as candidate_task_title, list.title as candidate_list_title,
      task.due_date as candidate_due_date,
      ((task.due_date::timestamp at time zone coalesce((select timezone.name from pg_timezone_names timezone where timezone.name = preference.time_zone limit 1), 'UTC')) - make_interval(mins => rule.offset_minutes)) as candidate_scheduled_for,
      coalesce(preference.due_soon, true) as candidate_in_app_enabled,
      coalesce(preference.email_reminders, true) as candidate_email_enabled,
      coalesce(preference.sms_reminders, false) as candidate_sms_enabled,
      preference.phone_e164 as candidate_phone_e164, preference.sms_opted_in_at as candidate_sms_opted_in_at
    from public.task_reminder_rules rule
    join public.collaboration_tasks task on task.id = rule.task_id and task.status not in ('done', 'deleted') and task.due_date is not null
    join public.collaboration_lists list on list.id = task.list_id and list.status not in ('archived', 'deleted')
    join public.task_assignments assignment on assignment.task_id = task.id
    cross join lateral unnest(rule.channels) as channel(value)
    left join public.notification_preferences preference on preference.owner_id = assignment.user_id
    where rule.enabled and p_now >= ((task.due_date::timestamp at time zone coalesce((select timezone.name from pg_timezone_names timezone where timezone.name = preference.time_zone limit 1), 'UTC')) - make_interval(mins => rule.offset_minutes))
  ), queued as (
    select candidates.*, 'task-reminder:' || candidate_task_id::text || ':' || candidate_recipient_id::text || ':' || candidate_channel || ':' || candidate_scheduled_for::date::text as candidate_event_key
    from candidates
  ), eligible as (
    select queued.* from queued
    where not exists (
      select 1 from public.task_reminder_deliveries delivery
      where delivery.event_key = queued.candidate_event_key
        and (delivery.status <> 'failed' or delivery.attempt_count >= 3)
    )
    order by candidate_scheduled_for, candidate_task_id, candidate_recipient_id, candidate_channel
    limit p_limit
  ), claimed as (
    insert into public.task_reminder_deliveries(event_key, task_id, rule_id, recipient_id, channel, scheduled_for)
    select candidate_event_key, candidate_task_id, rule_id, candidate_recipient_id, candidate_channel, candidate_scheduled_for
    from eligible
    on conflict (event_key) do update set status = 'pending', last_error = null, updated_at = timezone('utc', now())
      where public.task_reminder_deliveries.status = 'failed' and public.task_reminder_deliveries.attempt_count < 3
    returning id, event_key, task_id, recipient_id, channel, scheduled_for
  )
  select claimed.id, claimed.event_key, claimed.task_id, claimed.recipient_id, claimed.channel,
    candidates.candidate_task_title, candidates.candidate_list_title, candidates.candidate_due_date, claimed.scheduled_for,
    candidates.candidate_in_app_enabled, candidates.candidate_email_enabled, candidates.candidate_sms_enabled, candidates.candidate_phone_e164, candidates.candidate_sms_opted_in_at
  from claimed join eligible candidates on candidates.candidate_event_key = claimed.event_key;
end;
$$;

create or replace function public.record_task_reminder_delivery(
  p_delivery_id uuid, p_status text, p_provider_message_id text default null, p_last_error text default null
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then raise exception 'Service role required'; end if;
  if p_status not in ('sent', 'skipped', 'failed') then raise exception 'Invalid delivery status'; end if;
  update public.task_reminder_deliveries set status = p_status, provider_message_id = p_provider_message_id,
    last_error = left(p_last_error, 1000), attempt_count = attempt_count + 1,
    delivered_at = case when p_status in ('sent', 'skipped') then timezone('utc', now()) else null end,
    updated_at = timezone('utc', now()) where id = p_delivery_id;
end;
$$;

revoke all on function public.set_task_assignment(uuid, uuid, boolean) from public;
revoke all on function public.configure_task_reminder(uuid, boolean, integer, text[]) from public;
revoke all on function public.claim_due_task_reminders(timestamptz, integer) from public;
revoke all on function public.record_task_reminder_delivery(uuid, text, text, text) from public;
revoke all on function public.list_task_assignment_candidates(uuid) from public;
grant execute on function public.set_task_assignment(uuid, uuid, boolean), public.configure_task_reminder(uuid, boolean, integer, text[]), public.list_task_assignment_candidates(uuid) to authenticated;
grant execute on function public.claim_due_task_reminders(timestamptz, integer), public.record_task_reminder_delivery(uuid, text, text, text) to service_role;
