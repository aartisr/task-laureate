-- Task-Laureate application-data reset
--
-- Purpose: return an early-stage Supabase project to an empty Task-Laureate
-- workspace without changing the schema, migrations, RLS policies, RPCs,
-- extensions, storage, Auth configuration, or auth.users accounts.
--
-- Run only in the Supabase SQL Editor (or through a privileged database role).
-- It requires the collaboration core from migration 005 and clears optional
-- notification, push, and reminder tables only when they exist. A browser JWT
-- cannot TRUNCATE these tables, by design.
--
-- Safety interlock: replace CHANGE_ME with exactly
-- DELETE_ALL_TASK_LAUREATE_APPLICATION_DATA before executing this file.
-- The entire operation is one transaction: a failed preflight or truncate
-- rolls back all changes.

begin;

do $$
declare
  confirmation constant text := 'DELETE_ALL_TASK_LAUREATE_APPLICATION_DATA'';
  required_table text;
  target_table text;
  reset_tables text[] := array[
    'public.task_reminder_deliveries',
    'public.task_reminder_rules',
    'public.task_assignments',
    'public.task_collaborators',
    'public.list_collaborators',
    'public.share_invitations',
    'public.collaboration_tasks',
    'public.collaboration_lists',
    'public.collaboration_workspaces',
    'public.push_subscriptions',
    'public.notification_events',
    'public.notification_preferences'
  ];
  existing_tables text[];
begin
  if confirmation <> 'DELETE_ALL_TASK_LAUREATE_APPLICATION_DATA' then
    raise exception using
      message = 'Reset not confirmed: set the confirmation constant in reset_application_data.sql.',
      hint = 'This script deletes every Task-Laureate application record but preserves Auth users and schema.';
  end if;

  foreach required_table in array array[
    'public.collaboration_workspaces',
    'public.collaboration_lists',
    'public.collaboration_tasks',
    'public.list_collaborators',
    'public.task_collaborators',
    'public.share_invitations'
  ] loop
    if to_regclass(required_table) is null then
      raise exception using
        message = format('Reset stopped: required table %s is missing.', required_table),
        hint = 'Apply the collaboration foundation migration (005) before resetting application data.';
    end if;
  end loop;

  select array_agg(candidate.table_name order by candidate.ordinality)
  into existing_tables
  from unnest(reset_tables) with ordinality as candidate(table_name, ordinality)
  where to_regclass(candidate.table_name) is not null;

  -- The table list is explicit and child-first; do not use CASCADE, which
  -- could silently reset a future table that has not been reviewed here.
  execute 'truncate table ' || array_to_string(array(
    select format('%I.%I', 'public', replace(candidate.table_name, 'public.', ''))
    from unnest(existing_tables) as candidate(table_name)
  ), ', ') || ' restart identity';
end;
$$;

-- A successful run logs a zero-count summary for each table present here.
do $$
declare
  target_table text;
  remaining_rows bigint;
  summary jsonb := '{}'::jsonb;
begin
  foreach target_table in array array[
    'public.collaboration_workspaces', 'public.collaboration_lists', 'public.collaboration_tasks',
    'public.list_collaborators', 'public.task_collaborators', 'public.share_invitations',
    'public.notification_preferences', 'public.notification_events', 'public.push_subscriptions',
    'public.task_assignments', 'public.task_reminder_rules', 'public.task_reminder_deliveries'
  ] loop
    if to_regclass(target_table) is not null then
      execute format('select count(*) from %I.%I', 'public', replace(target_table, 'public.', '')) into remaining_rows;
      summary := summary || jsonb_build_object(replace(target_table, 'public.', ''), remaining_rows);
    end if;
  end loop;
  raise notice 'Task-Laureate reset summary: %', summary;
end;
$$;

commit;
