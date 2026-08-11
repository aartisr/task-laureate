-- 017 originally elevated the deletion RPC. Storage owns its protected object
-- table, so the elevated role can be denied despite the signed-in editor being
-- authorized by the bucket policy. Use the caller's RLS context end-to-end.
alter function public.delete_task_attachment(uuid) security invoker;

notify pgrst, 'reload schema';
