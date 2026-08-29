-- Durable, user-owned notification preferences and in-app inbox.
create table if not exists public.notification_preferences (
  owner_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  due_soon boolean not null default true,
  weekly_digest boolean not null default false,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  event_key text not null,
  kind text not null check (kind in ('due_soon', 'weekly_digest')),
  title text not null check (char_length(title) between 1 and 280),
  body text not null check (char_length(body) <= 1000),
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  unique (owner_id, event_key)
);

create index if not exists notification_events_owner_created_idx on public.notification_events (owner_id, created_at desc);

alter table public.notification_preferences enable row level security;
alter table public.notification_events enable row level security;

create policy "notification owner can read preferences" on public.notification_preferences for select to authenticated using (owner_id = auth.uid());
create policy "notification owner can create preferences" on public.notification_preferences for insert to authenticated with check (owner_id = auth.uid());
create policy "notification owner can update preferences" on public.notification_preferences for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "notification owner can read inbox" on public.notification_events for select to authenticated using (owner_id = auth.uid());
create policy "notification owner can update inbox" on public.notification_events for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
