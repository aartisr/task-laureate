-- Attachment removal must be one authorization and transaction boundary. The
-- previous client sequence could hide metadata before a Storage DELETE failed,
-- leaving an orphaned private object and an ambiguous UI error.
create or replace function public.delete_task_attachment(p_attachment_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare target public.task_attachments%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Sign in before removing an attachment'; end if;
  select * into target from public.task_attachments where id = p_attachment_id and deleted_at is null;
  if not found then raise exception 'Attachment not found or already removed'; end if;

  -- This runs with the caller's task and Storage RLS privileges. Deleting the
  -- Storage rows and hiding the metadata remains one database transaction.
  -- The respective DELETE and UPDATE policies enforce editor access; do not
  -- invoke a private helper directly from this caller-context function.
  delete from storage.objects where bucket_id = 'task-attachments' and name in (
    target.object_path, coalesce(target.thumbnail_path, ''), coalesce(target.preview_path, '')
  );
  update public.task_attachments set deleted_at = timezone('utc', now()) where id = target.id;
end;
$$;

grant execute on function public.delete_task_attachment(uuid) to authenticated;
notify pgrst, 'reload schema';
