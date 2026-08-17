-- A PL/pgSQL table-returning function exposes each output field as a local
-- variable. Qualifying the INSERT result avoids confusing that output field
-- with task_status_update_requests.recipient_id when a status request is
-- created.
create or replace function public.request_task_status_update(p_task_id uuid)
returns table (recipient_id uuid, list_id uuid, task_title text, list_title text)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare requester uuid := (select auth.uid());
begin
  if requester is null then raise exception 'Sign in to request a status update'; end if;
  if not private.can_manage_task_access(p_task_id) then raise exception 'Only the Task owner can request an update'; end if;
  if not exists (select 1 from public.collaboration_tasks where id = p_task_id and status not in ('done', 'deleted')) then
    raise exception 'Status updates can only be requested for active tasks';
  end if;

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
    returning public.task_status_update_requests.recipient_id as recipient_id
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

revoke all on function public.request_task_status_update(uuid) from public;
grant execute on function public.request_task_status_update(uuid) to authenticated;
notify pgrst, 'reload schema';
