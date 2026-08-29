-- Migration 041 correctly tightened direct access to the private task-owner
-- helper. The existing reminder-rule SELECT policy invoked that helper as the
-- browser role, however, so a List owner could no longer load this non-secret
-- configuration. Keep the authorization check in the policy itself instead of
-- granting browser roles execution access to a private helper.
drop policy if exists "owners read reminder rules" on public.task_reminder_rules;

create policy "owners read reminder rules" on public.task_reminder_rules
  for select to authenticated using (
    exists (
      select 1
      from public.collaboration_tasks task
      join public.collaboration_lists list on list.id = task.list_id
      where task.id = task_reminder_rules.task_id
        and (task.owner_id = (select auth.uid()) or list.owner_id = (select auth.uid()))
    )
  );

notify pgrst, 'reload schema';
