-- A task owner can ask assigned collaborators for an update without relying on
-- the due-date scheduler. Requests are durable, private, and rate-limited so
-- this remains a helpful prompt rather than a repeated nudge.
create table if not exists public.task_status_update_requests (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.collaboration_tasks(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete restrict,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  requested_at timestamptz not null default timezone('utc', now()),
  request_day date not null default (timezone('utc', now())::date),
  unique (task_id, requested_by, recipient_id, request_day)
);

create index if not exists task_status_update_requests_recent_idx
  on public.task_status_update_requests(task_id, requested_by, requested_at desc);

alter table public.task_status_update_requests enable row level security;

alter table public.notification_events drop constraint if exists notification_events_kind_check;
alter table public.notification_events add constraint notification_events_kind_check
  check (kind in ('due_soon', 'weekly_digest', 'task_assigned', 'task_reminder', 'status_update_request'));

create or replace function public.request_task_status_update(p_task_id uuid)
returns table (recipient_id uuid, list_id uuid, task_title text, list_title text)
language plpgsql security definer set search_path = '' as $$
declare requester uuid := (select auth.uid());
begin
  if requester is null then raise exception 'Sign in to request a status update'; end if;
  if not private.can_manage_task_access(p_task_id) then raise exception 'Only the Task owner can request an update'; end if;
  if not exists (select 1 from public.collaboration_tasks where id = p_task_id and status not in ('done', 'deleted')) then
    raise exception 'Status updates can only be requested for active tasks';
  end if;

  -- Each owner can request one update per recipient and task in a rolling day.
  -- Returning only newly-created rows lets the delivery layer remain idempotent.
  return query
  with recipients as (
    select assignment.user_id
    from public.task_assignments assignment
    where assignment.task_id = p_task_id and assignment.user_id <> requester
      and not exists (
        select 1 from public.task_status_update_requests prior
        where prior.task_id = p_task_id
          and prior.requested_by = requester
          and prior.recipient_id = assignment.user_id
          and prior.requested_at > timezone('utc', now()) - interval '24 hours'
      )
  ), created as (
    insert into public.task_status_update_requests(task_id, requested_by, recipient_id, request_day)
    select p_task_id, requester, recipients.user_id, timezone('utc', now())::date from recipients
    on conflict (task_id, requested_by, recipient_id, request_day) do nothing
    returning recipient_id
  ), context as (
    select task.list_id, task.title as task_title, list.title as list_title
    from public.collaboration_tasks task
    join public.collaboration_lists list on list.id = task.list_id
    where task.id = p_task_id
  ), events as (
    insert into public.notification_events(owner_id, event_key, kind, title, body)
    select created.recipient_id,
      'status-update-request:' || p_task_id::text || ':' || requester::text || ':' || to_char(timezone('utc', now()), 'YYYY-MM-DD'),
      'status_update_request',
      'Status update requested',
      left('Please update “' || context.task_title || '” in ' || context.list_title || ' when you have a moment.', 1000)
    from created cross join context
    on conflict (owner_id, event_key) do nothing
  )
  select created.recipient_id, context.list_id, context.task_title, context.list_title
  from created cross join context;
end;
$$;

revoke all on table public.task_status_update_requests from public;
revoke all on function public.request_task_status_update(uuid) from public;
grant execute on function public.request_task_status_update(uuid) to authenticated;
