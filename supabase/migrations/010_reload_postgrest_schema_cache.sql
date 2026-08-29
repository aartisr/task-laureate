-- Reassert the intended least-privilege RPC surface. This also protects an
-- existing project where function privileges were changed outside migrations.
grant execute on function public.create_share_invitation(text, uuid, text, text, text, timestamptz) to authenticated;
grant execute on function public.accept_share_invitation(text) to authenticated;
grant execute on function public.revoke_resource_access(text, uuid, uuid) to authenticated;
grant execute on function public.revoke_share_invitation(uuid) to authenticated;
grant execute on function public.list_shared_resources() to authenticated;

-- PostgREST discovers database functions through a schema cache. Reload it after
-- collaboration RPC migrations so invitation links do not briefly receive 404s
-- for functions that have already been created.
notify pgrst, 'reload schema';
