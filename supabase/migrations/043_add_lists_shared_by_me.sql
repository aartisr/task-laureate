-- Owner-facing outgoing-sharing index. It returns only Lists owned by the
-- signed-in person that have collaborators or active, unexpired invitations.
-- Counts keep the view fast and do not expose roster identities outside Share.
create index if not exists share_invitations_active_list_owner_idx
  on public.share_invitations(invited_by, resource_id)
  where resource_type = 'list' and status = 'pending';

create or replace function public.list_lists_shared_by_me()
returns table (
  list_id uuid,
  title text,
  description text,
  updated_at timestamptz,
  collaborator_count bigint,
  pending_invitation_count bigint
)
language sql stable security definer set search_path = '' as $$
  select
    list.id,
    list.title,
    list.description,
    list.updated_at,
    (select count(*) from public.list_collaborators member where member.list_id = list.id),
    (
      select count(*)
      from public.share_invitations invitation
      where invitation.resource_type = 'list'
        and invitation.resource_id = list.id
        and invitation.invited_by = (select auth.uid())
        and invitation.status = 'pending'
        and invitation.expires_at > timezone('utc', now())
    )
  from public.collaboration_lists list
  where list.owner_id = (select auth.uid())
    and list.status <> 'deleted'
    and (
      exists (select 1 from public.list_collaborators member where member.list_id = list.id)
      or exists (
        select 1
        from public.share_invitations invitation
        where invitation.resource_type = 'list'
          and invitation.resource_id = list.id
          and invitation.invited_by = (select auth.uid())
          and invitation.status = 'pending'
          and invitation.expires_at > timezone('utc', now())
      )
    )
  order by list.updated_at desc;
$$;

revoke all on function public.list_lists_shared_by_me() from public;
grant execute on function public.list_lists_shared_by_me() to authenticated;
notify pgrst, 'reload schema';
