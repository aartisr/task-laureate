-- A deletion is final once its private Storage objects are removed through the
-- Storage API. Use a dedicated DELETE policy instead of a soft-delete UPDATE:
-- it avoids the update-policy WITH CHECK path and has no mutable tombstone.
drop policy if exists "task editors or attachment owners remove metadata" on public.task_attachments;
drop policy if exists "task editors or attachment owners delete metadata" on public.task_attachments;
create policy "task editors or attachment owners delete metadata"
on public.task_attachments for delete to authenticated
using (owner_id = (select auth.uid()) or private.can_update_task(task_id));

grant delete on table public.task_attachments to authenticated;

notify pgrst, 'reload schema';
