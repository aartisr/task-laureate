-- Task-Laureate end-to-end seed matrix
--
-- Intended for a freshly reset LOCAL or STAGING Supabase project only.
-- It never creates auth.users. Supply three existing, distinct test-account
-- UUIDs below: an owner, an editor, and a read-only viewer.
--
-- Coverage: all List lifecycle states; every Task status × priority pair;
-- plain and rich notes; tags and due-date states; list/task access roles;
-- assignments; reminder rules/delivery states; notification preferences/events;
-- browser-push records; and every invitation state.
--
-- This is synthetic test data. Invitation records are deliberately not usable
-- links. Create invitations through the application to test the real one-time
-- token and email-delivery flow.

begin;

create temporary table task_laureate_seed_principals (
  role_name text primary key,
  user_id uuid not null,
  email_normalized text
) on commit drop;

-- Replace all three UUIDs before execution.
insert into task_laureate_seed_principals(role_name, user_id) values
  ('owner',  'e0339e50-ceff-462f-8ccb-81218822e054'),
  ('editor', 'dce0fc3e-91a4-4536-8945-d0fcc93a692c'),
  ('viewer', '8a3878d4-332c-44a3-a200-ba46e9647f4d');

do $$
declare
  environment_confirmation constant text := 'LOCAL_OR_STAGING_TEST_DATA_ONLY';
  principal_count integer;
begin
  if environment_confirmation <> 'LOCAL_OR_STAGING_TEST_DATA_ONLY' then
    raise exception using
      message = 'Seed stopped: set the environment confirmation in seed_test_matrix.sql.',
      hint = 'This inserts broad synthetic coverage data. Do not seed production.';
  end if;

  if exists (select 1 from task_laureate_seed_principals where user_id = '00000000-0000-0000-0000-000000000001'::uuid)
     or (select count(distinct user_id) from task_laureate_seed_principals) <> 3 then
    raise exception using
      message = 'Seed stopped: provide three distinct existing Supabase Auth user UUIDs.',
      hint = 'Find the UUIDs in Supabase Authentication → Users.';
  end if;

  select count(*) into principal_count
  from auth.users account join task_laureate_seed_principals principal on principal.user_id = account.id;
  if principal_count <> 3 then
    raise exception using
      message = 'Seed stopped: one or more supplied UUIDs do not exist in auth.users.',
      hint = 'Create three test accounts first, then copy their UUIDs into this file.';
  end if;

  if exists (select 1 from public.collaboration_workspaces)
    or exists (select 1 from public.collaboration_lists)
    or exists (select 1 from public.collaboration_tasks) then
    raise exception using
      message = 'Seed stopped: the application workspace is not empty.',
      hint = 'Run reset_application_data.sql first so test results are unambiguous.';
  end if;
end;
$$;

update task_laureate_seed_principals principal
set email_normalized = lower(account.email)
from auth.users account
where account.id = principal.user_id;

do $$
begin
  if exists (select 1 from task_laureate_seed_principals where email_normalized is null or email_normalized = '') then
    raise exception using
      message = 'Seed stopped: every test account must have an email address.',
      hint = 'Invitation coverage requires email-addressable test accounts.';
  end if;
end;
$$;

insert into public.collaboration_workspaces(id, owner_id, name)
select '10000000-0000-0000-0000-000000000001'::uuid, user_id, 'Seeded owner workspace'
from task_laureate_seed_principals where role_name = 'owner';

insert into public.collaboration_lists(id, workspace_id, owner_id, title, description, status, deleted_at) values
  ('11000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', (select user_id from task_laureate_seed_principals where role_name = 'owner'), 'Seed matrix — active', 'Every task status and priority, plus sharing and reminders.', 'active', null),
  ('11000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', (select user_id from task_laureate_seed_principals where role_name = 'owner'), 'Seed lifecycle — completed', 'Completed-list behavior.', 'completed', null),
  ('11000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', (select user_id from task_laureate_seed_principals where role_name = 'owner'), 'Seed lifecycle — archived', 'Archived-list behavior.', 'archived', null),
  ('11000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', (select user_id from task_laureate_seed_principals where role_name = 'owner'), 'Seed lifecycle — deleted', 'Deleted-list recovery behavior.', 'deleted', timezone('utc', now()));

-- Every task lifecycle status × every priority, including a rich-text note,
-- an overdue task, a due-today task, and a deleted task.
with combinations as (
  select status.value as status, priority.value as priority, row_number() over (order by status.value, priority.value) as ordinal
  from unnest(array['todo', 'doing', 'done', 'blocked', 'deleted']::text[]) as status(value)
  cross join unnest(array['low', 'medium', 'high', 'urgent']::text[]) as priority(value)
)
insert into public.collaboration_tasks(id, list_id, owner_id, title, note_document, status, priority, due_date, tags, order_key, completed_at, deleted_at)
select
  ('12000000-0000-0000-0000-' || lpad(ordinal::text, 12, '0'))::uuid,
  '11000000-0000-0000-0000-000000000001'::uuid,
  (select user_id from task_laureate_seed_principals where role_name = 'owner'),
  format('Seed task — %s / %s', status, priority),
  case
    when status = 'doing' and priority = 'high' then '<h2>Rich-note coverage</h2><p><strong>Formatted</strong> content with <a href="https://example.com" target="_blank">a safe link</a>.</p><ul><li>Checklist context</li><li>Searchable detail</li></ul>'
    when status = 'todo' and priority = 'urgent' then 'Plain-text note for overdue-task coverage.'
    else format('Synthetic %s priority task in %s state.', priority, status)
  end,
  status,
  priority,
  case when status = 'todo' and priority = 'urgent' then current_date - 2 when status = 'doing' and priority = 'medium' then current_date else current_date + ordinal::integer end,
  array['seed', status, priority],
  ordinal,
  case when status = 'done' then timezone('utc', now()) - interval '1 day' else null end,
  case when status = 'deleted' then timezone('utc', now()) else null end
from combinations;

insert into public.list_collaborators(list_id, user_id, role, granted_by)
select '11000000-0000-0000-0000-000000000001'::uuid, user_id,
  case when role_name = 'editor' then 'editor' else 'viewer' end,
  (select user_id from task_laureate_seed_principals where role_name = 'owner')
from task_laureate_seed_principals where role_name in ('editor', 'viewer');

insert into public.task_collaborators(task_id, user_id, role, granted_by) values
  ((select id from public.collaboration_tasks where title = 'Seed task — todo / low'), (select user_id from task_laureate_seed_principals where role_name = 'viewer'), 'viewer', (select user_id from task_laureate_seed_principals where role_name = 'owner')),
  ((select id from public.collaboration_tasks where title = 'Seed task — doing / urgent'), (select user_id from task_laureate_seed_principals where role_name = 'editor'), 'editor', (select user_id from task_laureate_seed_principals where role_name = 'owner'));

insert into public.task_assignments(task_id, user_id, assigned_by) values
  ((select id from public.collaboration_tasks where title = 'Seed task — doing / medium'), (select user_id from task_laureate_seed_principals where role_name = 'editor'), (select user_id from task_laureate_seed_principals where role_name = 'owner')),
  ((select id from public.collaboration_tasks where title = 'Seed task — todo / urgent'), (select user_id from task_laureate_seed_principals where role_name = 'viewer'), (select user_id from task_laureate_seed_principals where role_name = 'owner'));

insert into public.task_reminder_rules(id, task_id, offset_minutes, channels, enabled, created_by) values
  ('13000000-0000-0000-0000-000000000001', (select id from public.collaboration_tasks where title = 'Seed task — doing / medium'), 60, array['in_app', 'email'], true, (select user_id from task_laureate_seed_principals where role_name = 'owner')),
  ('13000000-0000-0000-0000-000000000002', (select id from public.collaboration_tasks where title = 'Seed task — todo / urgent'), 1440, array['in_app', 'sms'], false, (select user_id from task_laureate_seed_principals where role_name = 'owner'));

insert into public.task_reminder_deliveries(id, event_key, task_id, rule_id, recipient_id, channel, status, attempt_count, scheduled_for, delivered_at) values
  ('14000000-0000-0000-0000-000000000001', 'seed:delivery:sent', (select id from public.collaboration_tasks where title = 'Seed task — doing / medium'), '13000000-0000-0000-0000-000000000001', (select user_id from task_laureate_seed_principals where role_name = 'editor'), 'in_app', 'sent', 1, timezone('utc', now()) - interval '1 hour', timezone('utc', now()) - interval '1 hour'),
  ('14000000-0000-0000-0000-000000000002', 'seed:delivery:failed', (select id from public.collaboration_tasks where title = 'Seed task — doing / medium'), '13000000-0000-0000-0000-000000000001', (select user_id from task_laureate_seed_principals where role_name = 'editor'), 'email', 'failed', 1, timezone('utc', now()) - interval '30 minutes', null);

insert into public.notification_preferences(owner_id, due_soon, weekly_digest, email_reminders, sms_reminders, phone_e164, sms_opted_in_at, time_zone)
select user_id, role_name <> 'viewer', role_name = 'owner', role_name <> 'viewer', role_name = 'viewer',
  case when role_name = 'viewer' then '+14155550123' else null end,
  case when role_name = 'viewer' then timezone('utc', now()) else null end,
  case when role_name = 'editor' then 'America/New_York' else 'UTC' end
from task_laureate_seed_principals;

insert into public.notification_events(id, owner_id, event_key, kind, title, body, read_at) values
  ('15000000-0000-0000-0000-000000000001', (select user_id from task_laureate_seed_principals where role_name = 'editor'), 'seed:assigned', 'task_assigned', 'You were assigned a task', 'Seed notification for an assigned task.', null),
  ('15000000-0000-0000-0000-000000000002', (select user_id from task_laureate_seed_principals where role_name = 'viewer'), 'seed:reminder', 'task_reminder', 'A task is due soon', 'Seed notification for a task reminder.', timezone('utc', now()));

-- Browser push was introduced after the collaboration core. Seed it only in
-- environments where migration 004 has been applied.
do $$
begin
  if to_regclass('public.push_subscriptions') is not null then
    insert into public.push_subscriptions(id, owner_id, endpoint, p256dh, auth) values
      ('16000000-0000-0000-0000-000000000001',
       (select user_id from task_laureate_seed_principals where role_name = 'viewer'),
       'https://push.invalid/task-laureate/seed-viewer', 'seed-p256dh', 'seed-auth');
  end if;
end;
$$;

insert into public.share_invitations(id, resource_type, resource_id, email_normalized, role, token_digest, status, invited_by, accepted_by, expires_at, created_at) values
  ('17000000-0000-0000-0000-000000000001', 'list', '11000000-0000-0000-0000-000000000001', (select email_normalized from task_laureate_seed_principals where role_name = 'editor'), 'editor', lpad('1', 64, '0'), 'pending', (select user_id from task_laureate_seed_principals where role_name = 'owner'), null, timezone('utc', now()) + interval '7 days', timezone('utc', now()) - interval '1 day'),
  ('17000000-0000-0000-0000-000000000002', 'task', (select id from public.collaboration_tasks where title = 'Seed task — todo / low'), (select email_normalized from task_laureate_seed_principals where role_name = 'viewer'), 'viewer', lpad('2', 64, '0'), 'accepted', (select user_id from task_laureate_seed_principals where role_name = 'owner'), (select user_id from task_laureate_seed_principals where role_name = 'viewer'), timezone('utc', now()) + interval '7 days', timezone('utc', now()) - interval '1 day'),
  ('17000000-0000-0000-0000-000000000003', 'list', '11000000-0000-0000-0000-000000000002', (select email_normalized from task_laureate_seed_principals where role_name = 'viewer'), 'viewer', lpad('3', 64, '0'), 'declined', (select user_id from task_laureate_seed_principals where role_name = 'owner'), null, timezone('utc', now()) + interval '7 days', timezone('utc', now()) - interval '1 day'),
  ('17000000-0000-0000-0000-000000000004', 'list', '11000000-0000-0000-0000-000000000003', (select email_normalized from task_laureate_seed_principals where role_name = 'editor'), 'editor', lpad('4', 64, '0'), 'revoked', (select user_id from task_laureate_seed_principals where role_name = 'owner'), null, timezone('utc', now()) + interval '7 days', timezone('utc', now()) - interval '1 day'),
  ('17000000-0000-0000-0000-000000000005', 'task', (select id from public.collaboration_tasks where title = 'Seed task — blocked / high'), (select email_normalized from task_laureate_seed_principals where role_name = 'viewer'), 'viewer', lpad('5', 64, '0'), 'expired', (select user_id from task_laureate_seed_principals where role_name = 'owner'), null, timezone('utc', now()) - interval '1 day', timezone('utc', now()) - interval '2 days');

select jsonb_build_object(
  'lists', (select count(*) from public.collaboration_lists),
  'tasks', (select count(*) from public.collaboration_tasks),
  'list_roles', (select count(*) from public.list_collaborators),
  'task_roles', (select count(*) from public.task_collaborators),
  'assignments', (select count(*) from public.task_assignments),
  'reminder_rules', (select count(*) from public.task_reminder_rules),
  'reminder_deliveries', (select count(*) from public.task_reminder_deliveries),
  'invitations', (select count(*) from public.share_invitations)
) as seed_summary;

commit;
