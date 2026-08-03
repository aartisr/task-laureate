-- Collaboration foundation for Task Laureate.
--
-- This is deliberately separate from workspace_snapshots. Snapshot rows remain
-- private, owner-only backups; shared resources are first-class rows so RLS can
-- authorize individual Lists and Tasks without exposing a whole JSON payload.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;

create table if not exists public.collaboration_workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  name text not null default 'My workspace' check (char_length(name) between 1 and 250),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.collaboration_lists (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.collaboration_workspaces(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete restrict,
  title text not null check (char_length(title) between 1 and 500),
  description text not null default '',
  status text not null default 'active' check (status in ('active', 'completed', 'archived', 'deleted')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create table if not exists public.collaboration_tasks (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.collaboration_lists(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete restrict,
  title text not null check (char_length(title) between 1 and 500),
  note_document text not null default '' check (char_length(note_document) <= 250000),
  status text not null default 'todo' check (status in ('todo', 'doing', 'done', 'blocked', 'deleted')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  due_date date,
  tags text[] not null default '{}',
  order_key numeric(30, 12) not null default 0,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  deleted_at timestamptz
);

create table if not exists public.list_collaborators (
  list_id uuid not null references public.collaboration_lists(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('editor', 'viewer')),
  granted_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (list_id, user_id)
);

create table if not exists public.task_collaborators (
  task_id uuid not null references public.collaboration_tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('editor', 'viewer')),
  granted_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (task_id, user_id)
);

create table if not exists public.share_invitations (
  id uuid primary key default gen_random_uuid(),
  resource_type text not null check (resource_type in ('list', 'task')),
  resource_id uuid not null,
  email_normalized text not null check (email_normalized = lower(trim(email_normalized))),
  role text not null check (role in ('editor', 'viewer')),
  token_digest text not null unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'revoked', 'expired')),
  invited_by uuid not null references auth.users(id) on delete restrict,
  expires_at timestamptz not null,
  accepted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (expires_at > created_at)
);

create index if not exists collaboration_workspaces_owner_idx on public.collaboration_workspaces(owner_id);
create index if not exists collaboration_lists_workspace_idx on public.collaboration_lists(workspace_id);
create index if not exists collaboration_lists_owner_idx on public.collaboration_lists(owner_id);
create index if not exists collaboration_tasks_list_order_idx on public.collaboration_tasks(list_id, order_key);
create index if not exists collaboration_tasks_owner_idx on public.collaboration_tasks(owner_id);
create index if not exists list_collaborators_user_list_idx on public.list_collaborators(user_id, list_id);
create index if not exists task_collaborators_user_task_idx on public.task_collaborators(user_id, task_id);
create index if not exists share_invitations_inviter_idx on public.share_invitations(invited_by, status);
create index if not exists share_invitations_email_status_idx on public.share_invitations(email_normalized, status);

-- Security-definer helpers are intentionally private and use a locked search
-- path. They are predicates for RLS, not public application endpoints.
create or replace function private.can_read_list(target_list_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.collaboration_lists list
    where list.id = target_list_id and (
      list.owner_id = (select auth.uid()) or exists (
        select 1 from public.list_collaborators member
        where member.list_id = list.id and member.user_id = (select auth.uid())
      )
    )
  );
$$;

create or replace function private.can_update_tasks_in_list(target_list_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.collaboration_lists list
    where list.id = target_list_id and (
      list.owner_id = (select auth.uid()) or exists (
        select 1 from public.list_collaborators member
        where member.list_id = list.id and member.user_id = (select auth.uid()) and member.role = 'editor'
      )
    )
  );
$$;

create or replace function private.can_read_task(target_task_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.collaboration_tasks task
    join public.collaboration_lists list on list.id = task.list_id
    where task.id = target_task_id and (
      task.owner_id = (select auth.uid())
      or private.can_read_list(task.list_id)
      or exists (select 1 from public.task_collaborators member where member.task_id = task.id and member.user_id = (select auth.uid()))
    )
  );
$$;

create or replace function private.can_update_task(target_task_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.collaboration_tasks task
    where task.id = target_task_id and (
      task.owner_id = (select auth.uid())
      or private.can_update_tasks_in_list(task.list_id)
      or exists (select 1 from public.task_collaborators member where member.task_id = task.id and member.user_id = (select auth.uid()) and member.role = 'editor')
    )
  );
$$;

create or replace function private.can_manage_list_access(target_list_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.collaboration_lists where id = target_list_id and owner_id = (select auth.uid()));
$$;

create or replace function private.can_manage_task_access(target_task_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.collaboration_tasks where id = target_task_id and owner_id = (select auth.uid()));
$$;

create or replace function private.protect_collaboration_task_mutation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.owner_id <> old.owner_id or new.list_id <> old.list_id then
    raise exception 'Task ownership and List placement are immutable in this collaboration stage';
  end if;
  -- The database, not a browser clock, owns mutation versioning and timestamps.
  new.version := old.version + 1;
  new.updated_at := timezone('utc', now());
  if new.status = 'done' and old.status <> 'done' then new.completed_at := new.updated_at; end if;
  if new.status <> 'done' then new.completed_at := null; end if;
  return new;
end;
$$;

drop trigger if exists protect_collaboration_task_mutation on public.collaboration_tasks;
create trigger protect_collaboration_task_mutation before update on public.collaboration_tasks
for each row execute function private.protect_collaboration_task_mutation();

create or replace function private.touch_collaboration_list()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.owner_id <> old.owner_id or new.workspace_id <> old.workspace_id then
    raise exception 'Only an owner may change List ownership or workspace';
  end if;
  new.version := old.version + 1;
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists touch_collaboration_list on public.collaboration_lists;
create trigger touch_collaboration_list before update on public.collaboration_lists
for each row execute function private.touch_collaboration_list();

alter table public.collaboration_workspaces enable row level security;
alter table public.collaboration_lists enable row level security;
alter table public.collaboration_tasks enable row level security;
alter table public.list_collaborators enable row level security;
alter table public.task_collaborators enable row level security;
alter table public.share_invitations enable row level security;

create policy "workspace owners manage their collaboration workspace" on public.collaboration_workspaces
  for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy "owners and members read shared lists" on public.collaboration_lists
  for select to authenticated using ((select private.can_read_list(id)));
create policy "owners create lists" on public.collaboration_lists
  for insert to authenticated with check (owner_id = (select auth.uid()) and exists (
    select 1 from public.collaboration_workspaces workspace where workspace.id = workspace_id and workspace.owner_id = (select auth.uid())
  ));
create policy "owners update list structure" on public.collaboration_lists
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "owners delete lists" on public.collaboration_lists
  for delete to authenticated using (owner_id = (select auth.uid()));

create policy "authorized users read tasks" on public.collaboration_tasks
  for select to authenticated using ((select private.can_read_task(id)));
create policy "owners and list editors create tasks" on public.collaboration_tasks
  for insert to authenticated with check (
    (select private.can_update_tasks_in_list(list_id)) and owner_id = (
      select owner_id from public.collaboration_lists where id = list_id
    )
  );
create policy "owners and editors update tasks" on public.collaboration_tasks
  for update to authenticated using ((select private.can_update_task(id))) with check ((select private.can_update_task(id)));
create policy "owners and editors delete tasks" on public.collaboration_tasks
  for delete to authenticated using ((select private.can_update_task(id)));

-- Memberships are deliberately not writable via the Data API. Owner-only RPCs
-- below are the single mutation boundary, eliminating role-escalation writes.
create policy "people can see memberships for resources they can read" on public.list_collaborators
  for select to authenticated using ((select private.can_read_list(list_id)));
create policy "people can see memberships for explicitly shared tasks" on public.task_collaborators
  for select to authenticated using ((select private.can_read_task(task_id)));
create policy "owners see their invitations" on public.share_invitations
  for select to authenticated using (invited_by = (select auth.uid()));

create or replace function public.create_share_invitation(
  p_resource_type text,
  p_resource_id uuid,
  p_email_normalized text,
  p_role text,
  p_token_digest text,
  p_expires_at timestamptz
) returns uuid language plpgsql security definer set search_path = '' as $$
declare invitation_id uuid;
begin
  if p_resource_type not in ('list', 'task') or p_role not in ('editor', 'viewer') then raise exception 'Invalid invitation'; end if;
  if p_expires_at <= timezone('utc', now()) or p_expires_at > timezone('utc', now()) + interval '30 days' then raise exception 'Invitation expiry must be within 30 days'; end if;
  if p_resource_type = 'list' and not private.can_manage_list_access(p_resource_id) then raise exception 'Only the List owner can invite people'; end if;
  if p_resource_type = 'task' and not private.can_manage_task_access(p_resource_id) then raise exception 'Only the Task owner can invite people'; end if;
  insert into public.share_invitations(resource_type, resource_id, email_normalized, role, token_digest, invited_by, expires_at)
  values (p_resource_type, p_resource_id, lower(trim(p_email_normalized)), p_role, p_token_digest, (select auth.uid()), p_expires_at)
  returning id into invitation_id;
  return invitation_id;
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

create or replace function public.revoke_resource_access(p_resource_type text, p_resource_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_resource_type = 'list' and private.can_manage_list_access(p_resource_id) then
    delete from public.list_collaborators where list_id = p_resource_id and user_id = p_user_id;
  elsif p_resource_type = 'task' and private.can_manage_task_access(p_resource_id) then
    delete from public.task_collaborators where task_id = p_resource_id and user_id = p_user_id;
  else raise exception 'Only the resource owner can revoke access'; end if;
end;
$$;

-- Revocation is intentionally a state transition rather than a delete. It
-- preserves a security-relevant audit trail while making an old token unusable.
create or replace function public.revoke_share_invitation(p_invitation_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.share_invitations
  set status = 'revoked', updated_at = timezone('utc', now())
  where id = p_invitation_id
    and status = 'pending'
    and invited_by = (select auth.uid());
  if not found then raise exception 'Only the invitation owner can revoke a pending invitation'; end if;
end;
$$;

grant select, insert, update, delete on public.collaboration_workspaces, public.collaboration_lists, public.collaboration_tasks to authenticated;
grant select on public.list_collaborators, public.task_collaborators, public.share_invitations to authenticated;
grant execute on function public.create_share_invitation(text, uuid, text, text, text, timestamptz) to authenticated;
grant execute on function public.accept_share_invitation(text) to authenticated;
grant execute on function public.revoke_resource_access(text, uuid, uuid) to authenticated;
grant execute on function public.revoke_share_invitation(uuid) to authenticated;
