-- Browser push is opt-in and device-specific. The durable in-app inbox stays
-- authoritative; this table only stores the encrypted Web Push subscription.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique check (char_length(endpoint) between 1 and 4096),
  p256dh text not null check (char_length(p256dh) between 1 and 512),
  auth text not null check (char_length(auth) between 1 and 512),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  last_success_at timestamptz,
  last_failure_at timestamptz
);

create index if not exists push_subscriptions_owner_idx on public.push_subscriptions (owner_id);

alter table public.push_subscriptions enable row level security;

create policy "push subscription owner can read" on public.push_subscriptions for select to authenticated using (owner_id = auth.uid());
create policy "push subscription owner can create" on public.push_subscriptions for insert to authenticated with check (owner_id = auth.uid());
create policy "push subscription owner can update" on public.push_subscriptions for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "push subscription owner can delete" on public.push_subscriptions for delete to authenticated using (owner_id = auth.uid());

revoke all on table public.push_subscriptions from anon;
grant select, insert, update, delete on table public.push_subscriptions to authenticated;
grant select, insert, update on table public.notification_preferences to authenticated;
grant select, update on table public.notification_events to authenticated;
