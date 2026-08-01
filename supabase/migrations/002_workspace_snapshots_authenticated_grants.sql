-- Explicit Data API privileges for the authenticated browser role.
-- RLS still restricts every permitted operation to owner_id = auth.uid().
grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.workspace_snapshots to authenticated;
