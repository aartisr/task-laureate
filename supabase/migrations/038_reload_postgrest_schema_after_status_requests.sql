-- Migration 037 introduced request_task_status_update but omitted the PostgREST
-- schema reload performed by the other RPC migrations. Without it, PostgREST
-- can continue returning PGRST202/404 for a function that PostgreSQL already
-- created. This follow-up is intentionally safe to apply to every environment.
notify pgrst, 'reload schema';
