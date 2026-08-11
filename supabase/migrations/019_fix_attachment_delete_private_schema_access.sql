-- 018 correctly switched the RPC to the caller's RLS context. Its remaining
-- direct call to private.can_update_task, however, requires application roles
-- to have USAGE on the private schema. Keep that schema private and rely on
-- the Storage DELETE and attachment UPDATE policies to authorize each write.
create or replace function public.delete_task_attachment(p_attachment_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare target public.task_attachments%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Sign in before removing an attachment'; end if;

  select * into target from public.task_attachments where id = p_attachment_id and deleted_at is null;
  if not found then raise exception 'Attachment not found or already removed'; end if;

  delete from storage.objects where bucket_id = 'task-attachments' and name in (
    target.object_path, coalesce(target.thumbnail_path, ''), coalesce(target.preview_path, '')
  );
  update public.task_attachments set deleted_at = timezone('utc', now()) where id = target.id;
end;
$$;

grant execute on function public.delete_task_attachment(uuid) to authenticated;
notify pgrst, 'reload schema';
