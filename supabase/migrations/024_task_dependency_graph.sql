-- Directed, acyclic task-dependency graph. The database enforces the graph so
-- imports, REST clients, and future automations cannot bypass completion gates.
create table public.task_dependencies (
  id uuid primary key default gen_random_uuid(),
  prerequisite_task_id uuid not null references public.collaboration_tasks(id) on delete cascade,
  dependent_task_id uuid not null references public.collaboration_tasks(id) on delete cascade,
  dependency_type text not null default 'finish_to_start' check (dependency_type in ('finish_to_start', 'start_to_start', 'finish_to_finish', 'start_to_finish')),
  is_required boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  check (prerequisite_task_id <> dependent_task_id),
  unique (prerequisite_task_id, dependent_task_id, dependency_type)
);

create index task_dependencies_dependent_idx on public.task_dependencies(dependent_task_id) where is_required;
create index task_dependencies_prerequisite_idx on public.task_dependencies(prerequisite_task_id);

create or replace function private.task_dependency_would_cycle(p_prerequisite uuid, p_dependent uuid, p_ignored_id uuid default null)
returns boolean language sql stable security definer set search_path = '' as $$
  with recursive descendants(task_id) as (
    select p_dependent
    union
    select edge.dependent_task_id
    from public.task_dependencies edge
    join descendants on edge.prerequisite_task_id = descendants.task_id
    where edge.id is distinct from p_ignored_id
  )
  select exists (select 1 from descendants where task_id = p_prerequisite);
$$;

create or replace function private.protect_task_dependency_graph()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if private.task_dependency_would_cycle(new.prerequisite_task_id, new.dependent_task_id, case when tg_op = 'UPDATE' then old.id else null end) then
    raise exception 'This dependency would create a cycle. Choose a task that does not already depend on this one.';
  end if;
  return new;
end;
$$;

create trigger protect_task_dependency_graph before insert or update on public.task_dependencies
for each row execute function private.protect_task_dependency_graph();

-- Completion is a hard invariant for required finish-to-start dependencies.
-- Other relationship types are retained for the future scheduling layer but do
-- not block completion until start dates/durations exist.
create or replace function private.prevent_completion_with_unresolved_dependencies()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'done' and old.status <> 'done' and exists (
    select 1 from public.task_dependencies edge
    join public.collaboration_tasks prerequisite on prerequisite.id = edge.prerequisite_task_id
    where edge.dependent_task_id = new.id
      and edge.is_required
      and edge.dependency_type = 'finish_to_start'
      and prerequisite.status <> 'done'
      and prerequisite.deleted_at is null
  ) then
    raise exception 'Complete every required prerequisite before completing this task.';
  end if;
  return new;
end;
$$;

create trigger prevent_completion_with_unresolved_dependencies before update of status on public.collaboration_tasks
for each row execute function private.prevent_completion_with_unresolved_dependencies();

alter table public.task_dependencies enable row level security;
create policy "people with task access read dependencies" on public.task_dependencies for select to authenticated
using (private.can_read_task(prerequisite_task_id) and private.can_read_task(dependent_task_id));
create policy "task editors create dependencies" on public.task_dependencies for insert to authenticated
with check (created_by = auth.uid() and private.can_update_task(prerequisite_task_id) and private.can_update_task(dependent_task_id));
create policy "task editors remove dependencies" on public.task_dependencies for delete to authenticated
using (private.can_update_task(prerequisite_task_id) and private.can_update_task(dependent_task_id));

grant select, insert, delete on public.task_dependencies to authenticated;

-- Bounded list-card projection: avoids one graph query per visible task.
create or replace function public.get_task_dependency_summaries(p_task_ids uuid[])
returns table (task_id uuid, unresolved_prerequisite_count integer, dependent_count integer)
language sql stable security invoker set search_path = '' as $$
  with requested as (select distinct unnest(p_task_ids) as task_id)
  select requested.task_id,
    count(edge.id) filter (
      where edge.dependent_task_id = requested.task_id
        and edge.is_required
        and edge.dependency_type = 'finish_to_start'
        and prerequisite.status <> 'done'
        and prerequisite.deleted_at is null
    )::integer as unresolved_prerequisite_count,
    count(edge.id) filter (where edge.prerequisite_task_id = requested.task_id)::integer as dependent_count
  from requested
  left join public.task_dependencies edge on edge.dependent_task_id = requested.task_id or edge.prerequisite_task_id = requested.task_id
  left join public.collaboration_tasks prerequisite on prerequisite.id = edge.prerequisite_task_id
  group by requested.task_id;
$$;

grant execute on function public.get_task_dependency_summaries(uuid[]) to authenticated;
notify pgrst, 'reload schema';
