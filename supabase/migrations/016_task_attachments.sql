-- Immutable, private task attachments. Originals are retained; preview and
-- thumbnail paths are optional derived assets produced by a worker.
create table if not exists public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.collaboration_tasks(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  object_path text not null unique check (object_path ~ '^tasks/[0-9a-f-]{36}/[0-9a-f-]{36}/original$'),
  thumbnail_path text,
  preview_path text,
  original_name text not null check (char_length(original_name) between 1 and 255),
  content_type text not null check (content_type in (
    'image/jpeg','image/png','image/webp','image/avif','image/heic','image/heif','image/gif',
    'application/pdf','text/plain','text/markdown','text/csv','application/json',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  )),
  byte_size bigint not null check (byte_size between 1 and 104857600),
  sha256 text,
  kind text not null check (kind in ('image','pdf','text','document','file')),
  status text not null default 'ready' check (status in ('uploading','processing','ready','rejected','failed')),
  created_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);
create index if not exists task_attachments_task_created_idx on public.task_attachments(task_id, created_at desc) where deleted_at is null;

create or replace function private.protect_task_attachment_mutation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Only a trusted processor may alter content identity or processing state.
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' and (
    new.task_id <> old.task_id or new.owner_id <> old.owner_id or new.object_path <> old.object_path
    or new.thumbnail_path is distinct from old.thumbnail_path or new.preview_path is distinct from old.preview_path
    or new.original_name <> old.original_name or new.content_type <> old.content_type
    or new.byte_size <> old.byte_size or new.sha256 is distinct from old.sha256
    or new.kind <> old.kind or new.status <> old.status or new.deleted_at is null
  ) then raise exception 'Attachment content is immutable'; end if;
  return new;
end;
$$;
drop trigger if exists protect_task_attachment_mutation on public.task_attachments;
create trigger protect_task_attachment_mutation before update on public.task_attachments for each row execute function private.protect_task_attachment_mutation();

alter table public.task_attachments enable row level security;
create policy "people with task access read attachment metadata" on public.task_attachments for select to authenticated using (deleted_at is null and private.can_read_task(task_id));
create policy "task editors create attachment metadata" on public.task_attachments for insert to authenticated with check (owner_id = auth.uid() and private.can_update_task(task_id));
create policy "task editors delete attachment metadata" on public.task_attachments for update to authenticated using (private.can_update_task(task_id)) with check (private.can_update_task(task_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('task-attachments', 'task-attachments', false, 104857600, array[
  'image/jpeg','image/png','image/webp','image/avif','image/heic','image/heif','image/gif',
  'application/pdf','text/plain','text/markdown','text/csv','application/json',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'
]) on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Object paths are tasks/{task-id}/{attachment-id}/original. Storage policy
-- repeats task authorization; metadata is never the authorization boundary.
create policy "task readers download private attachments" on storage.objects for select to authenticated using (
  bucket_id = 'task-attachments' and private.can_read_task((storage.foldername(name))[2]::uuid)
);
create policy "task editors upload private attachments" on storage.objects for insert to authenticated with check (
  bucket_id = 'task-attachments' and private.can_update_task((storage.foldername(name))[2]::uuid)
);
create policy "task editors remove private attachments" on storage.objects for delete to authenticated using (
  bucket_id = 'task-attachments' and private.can_update_task((storage.foldername(name))[2]::uuid)
);
