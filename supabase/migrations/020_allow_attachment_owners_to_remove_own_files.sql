-- A shared-task viewer who uploaded an attachment must be able to remove only
-- that attachment. Editors retain the ability to remove any attachment.
create or replace function private.can_remove_task_attachment_object(target_object_path text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.task_attachments attachment
    where target_object_path in (
      attachment.object_path,
      coalesce(attachment.thumbnail_path, ''),
      coalesce(attachment.preview_path, '')
    )
      and attachment.deleted_at is null
      and (
        attachment.owner_id = (select auth.uid())
        or private.can_update_task(attachment.task_id)
      )
  );
$$;

drop policy if exists "task editors delete attachment metadata" on public.task_attachments;
drop policy if exists "task editors or attachment owners remove metadata" on public.task_attachments;
create policy "task editors or attachment owners remove metadata"
on public.task_attachments for update to authenticated
using (owner_id = (select auth.uid()) or private.can_update_task(task_id))
with check (owner_id = (select auth.uid()) or private.can_update_task(task_id));

drop policy if exists "task editors remove private attachments" on storage.objects;
drop policy if exists "task editors or attachment owners remove private attachments" on storage.objects;
create policy "task editors or attachment owners remove private attachments"
on storage.objects for delete to authenticated using (
  bucket_id = 'task-attachments'
  and private.can_remove_task_attachment_object(name)
);

notify pgrst, 'reload schema';
