-- A recipient can safely reopen an invitation link after accepting it. This is
-- especially important on mobile, where a browser or mail client may reopen a
-- link while returning to the app. Only the account that accepted the invite
-- receives the resource destination; other accounts still learn nothing about
-- the shared work.
create or replace function public.accept_share_invitation(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare invitation public.share_invitations%rowtype;
declare user_email text;
begin
  select lower(coalesce(auth.jwt() ->> 'email', '')) into user_email;
  if user_email = '' then raise exception 'An email-verified account is required to accept an invitation'; end if;

  select * into invitation from public.share_invitations
  where token_digest = encode(extensions.digest(p_token, 'sha256'), 'hex') for update;

  if not found then raise exception 'Invitation is unavailable'; end if;

  -- Preserve a stable deep-link destination for the recipient who already
  -- accepted this invite, while keeping all other accounts on the safe generic
  -- unavailable path.
  if invitation.status = 'accepted' then
    if invitation.accepted_by = (select auth.uid()) then
      return jsonb_build_object('resourceType', invitation.resource_type, 'resourceId', invitation.resource_id, 'role', invitation.role);
    end if;
    raise exception 'Invitation is unavailable';
  end if;

  if invitation.status <> 'pending' then raise exception 'Invitation is unavailable'; end if;
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
