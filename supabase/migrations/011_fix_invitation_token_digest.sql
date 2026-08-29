-- `accept_share_invitation` deliberately runs with an empty search path so a
-- caller cannot influence names resolved by this security-definer function.
-- pgcrypto's digest() must therefore be installed in, and referenced from, a
-- known schema instead of being resolved through the caller's search path.
create schema if not exists extensions;

do $$
declare current_schema name;
begin
  select namespace.nspname
  into current_schema
  from pg_extension extension
  join pg_namespace namespace on namespace.oid = extension.extnamespace
  where extension.extname = 'pgcrypto';

  if current_schema is null then
    create extension pgcrypto with schema extensions;
  elsif current_schema <> 'extensions' then
    alter extension pgcrypto set schema extensions;
  end if;
end;
$$;

create or replace function public.accept_share_invitation(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare invitation public.share_invitations%rowtype;
declare user_email text;
begin
  select lower(coalesce(auth.jwt() ->> 'email', '')) into user_email;
  if user_email = '' then raise exception 'An email-verified account is required to accept an invitation'; end if;
  select * into invitation from public.share_invitations
  where token_digest = encode(extensions.digest(p_token, 'sha256'), 'hex') for update;
  if not found or invitation.status <> 'pending' then raise exception 'Invitation is unavailable'; end if;
  if invitation.expires_at <= timezone('utc', now()) then
    update public.share_invitations set status = 'expired', updated_at = timezone('utc', now()) where id = invitation.id;
    raise exception 'Invitation has expired';
  end if;
  if invitation.email_normalized <> user_email then raise exception 'Invitation does not belong to this account'; end if;
  if invitation.resource_type = 'list' then
    insert into public.list_collaborators(list_id, user_id, role, granted_by)
    values (invitation.resource_id, (select auth.uid()), invitation.role, invitation.invited_by)
    on conflict (list_id, user_id) do update set role = case when excluded.role = 'editor' then 'editor' else public.list_collaborators.role end, updated_at = timezone('utc', now());
  else
    insert into public.task_collaborators(task_id, user_id, role, granted_by)
    values (invitation.resource_id, (select auth.uid()), invitation.role, invitation.invited_by)
    on conflict (task_id, user_id) do update set role = case when excluded.role = 'editor' then 'editor' else public.task_collaborators.role end, updated_at = timezone('utc', now());
  end if;
  update public.share_invitations set status = 'accepted', accepted_by = (select auth.uid()), updated_at = timezone('utc', now()) where id = invitation.id;
  return jsonb_build_object('resourceType', invitation.resource_type, 'resourceId', invitation.resource_id, 'role', invitation.role);
end;
$$;

grant execute on function public.accept_share_invitation(text) to authenticated;
notify pgrst, 'reload schema';
