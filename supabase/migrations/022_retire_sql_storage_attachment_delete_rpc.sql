-- Supabase Storage rejects direct SQL deletion from storage.objects. The web
-- client now uses the supported Storage API, followed by RLS-protected
-- metadata soft deletion, so retire the invalid RPC endpoint.
drop function if exists public.delete_task_attachment(uuid);

notify pgrst, 'reload schema';
