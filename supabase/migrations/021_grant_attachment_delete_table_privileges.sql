-- RLS policies constrain which rows an authenticated user may change, but
-- PostgreSQL also requires the underlying table privilege before RLS runs.
-- Grant only the operations used by the attachment deletion transaction.
grant usage on schema storage to authenticated;
grant delete on table storage.objects to authenticated;
grant update on table public.task_attachments to authenticated;

notify pgrst, 'reload schema';
