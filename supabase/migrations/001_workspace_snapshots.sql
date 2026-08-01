-- Task-Laureate's portable workspace store. Apply with `supabase db push`.
create table if not exists public.workspace_snapshots (
  workspace_id text primary key check (workspace_id ~ '^[A-Za-z0-9_-]{1,120}$'),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  version integer not null check (version = 1),
  payload jsonb not null,
  updated_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.workspace_snapshots enable row level security;

create policy "workspace owner can read" on public.workspace_snapshots for select to authenticated using (owner_id = auth.uid());
create policy "workspace owner can create" on public.workspace_snapshots for insert to authenticated with check (owner_id = auth.uid());
create policy "workspace owner can update" on public.workspace_snapshots for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "workspace owner can delete" on public.workspace_snapshots for delete to authenticated using (owner_id = auth.uid());

create index if not exists workspace_snapshots_owner_updated_idx on public.workspace_snapshots (owner_id, updated_at desc);
