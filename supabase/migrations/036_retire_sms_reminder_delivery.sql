-- This production installation deliberately offers in-app and email reminders
-- only. Retire any historical SMS work before it can reach a paid provider.
update public.task_reminder_rules
set channels = case
  when array_remove(channels, 'sms') <> '{}'::text[] then array_remove(channels, 'sms')
  else array['email']::text[]
end,
updated_at = timezone('utc', now())
where 'sms' = any(channels);

update public.task_reminder_deliveries
set status = 'skipped', last_error = 'SMS reminders are not offered by this installation.', delivered_at = timezone('utc', now()), updated_at = timezone('utc', now())
where channel = 'sms' and status in ('pending', 'failed');

create or replace function public.configure_task_reminder(p_task_id uuid, p_enabled boolean, p_offset_minutes integer default 1440, p_channels text[] default array['in_app', 'email']::text[])
returns public.task_reminder_rules language plpgsql security definer set search_path = '' as $$
declare configured public.task_reminder_rules%rowtype;
begin
  if not private.can_manage_task_access(p_task_id) then raise exception 'Only the Task owner can configure reminders'; end if;
  if p_offset_minutes < 0 or p_offset_minutes > 43200 then raise exception 'Reminder offset must be between 0 minutes and 30 days'; end if;
  if cardinality(p_channels) is null or cardinality(p_channels) < 1 or cardinality(p_channels) > 2 or exists (select 1 from unnest(p_channels) channel where channel not in ('in_app', 'email')) then raise exception 'Choose in-app, email, or both for reminders'; end if;
  insert into public.task_reminder_rules(task_id, enabled, offset_minutes, channels, created_by) values (p_task_id, p_enabled, p_offset_minutes, p_channels, (select auth.uid()))
  on conflict (task_id) do update set enabled = excluded.enabled, offset_minutes = excluded.offset_minutes, channels = excluded.channels, updated_at = timezone('utc', now()) returning * into configured;
  return configured;
end;
$$;

revoke all on function public.configure_task_reminder(uuid, boolean, integer, text[]) from public;
grant execute on function public.configure_task_reminder(uuid, boolean, integer, text[]) to authenticated;
notify pgrst, 'reload schema';
