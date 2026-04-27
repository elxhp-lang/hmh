-- Worker baseline for Creative Xiaohai
-- Idempotent migration: safe to run multiple times.

begin;

create table if not exists public.worker_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  client_request_id text null,
  session_id uuid null references public.agent_sessions(id) on delete set null,
  task_type text not null default 'creative_chat',
  status text not null default 'queued',
  progress integer not null default 0,
  priority integer not null default 0,
  input_data jsonb not null default '{}'::jsonb,
  output_data jsonb not null default '{}'::jsonb,
  error_message text null,
  retry_count integer not null default 0,
  max_retries integer not null default 2,
  queued_at timestamptz not null default now(),
  started_at timestamptz null,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.worker_tasks(id) on delete cascade,
  user_id text not null,
  session_id uuid null references public.agent_sessions(id) on delete set null,
  event_type text not null,
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.task_outputs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.worker_tasks(id) on delete cascade,
  user_id text not null,
  session_id uuid null references public.agent_sessions(id) on delete set null,
  message_id text null references public.agent_conversation_messages(id) on delete set null,
  output_type text not null default 'assistant_message',
  parts jsonb not null default '[]'::jsonb,
  text_content text null,
  created_at timestamptz not null default now()
);

create table if not exists public.worker_task_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.worker_tasks(id) on delete cascade,
  user_id text not null,
  session_id uuid null references public.agent_sessions(id) on delete set null,
  item_index integer not null default 0,
  status text not null default 'queued',
  progress integer not null default 0,
  input_data jsonb not null default '{}'::jsonb,
  output_data jsonb not null default '{}'::jsonb,
  error_message text null,
  started_at timestamptz null,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.worker_tasks add column if not exists client_request_id text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'worker_tasks_status_check'
  ) then
    alter table public.worker_tasks
      add constraint worker_tasks_status_check
      check (status in ('queued','running','succeeded','failed','cancelled','partial_succeeded'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'worker_task_items_status_check'
  ) then
    alter table public.worker_task_items
      add constraint worker_task_items_status_check
      check (status in ('queued','running','succeeded','failed','cancelled'));
  end if;
end $$;

create index if not exists idx_worker_tasks_user_status_created
  on public.worker_tasks(user_id, status, created_at desc);

create index if not exists idx_worker_tasks_session_created
  on public.worker_tasks(session_id, created_at desc);

create index if not exists idx_worker_tasks_status_priority_created
  on public.worker_tasks(status, priority desc, queued_at asc);

create index if not exists idx_task_events_task_created
  on public.task_events(task_id, created_at asc);

create index if not exists idx_task_outputs_task_created
  on public.task_outputs(task_id, created_at asc);

create unique index if not exists uq_worker_tasks_user_request
  on public.worker_tasks(user_id, client_request_id)
  where client_request_id is not null;

create index if not exists idx_worker_task_items_task_status
  on public.worker_task_items(task_id, status, created_at asc);

create index if not exists idx_worker_task_items_user_status
  on public.worker_task_items(user_id, status, created_at desc);

create or replace function public.sync_worker_task_completed_at()
returns trigger
language plpgsql
as $$
begin
  if new.status in ('succeeded','failed','cancelled','partial_succeeded') and new.completed_at is null then
    new.completed_at := now();
  end if;
  if new.status = 'running' and new.started_at is null then
    new.started_at := now();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_worker_tasks_sync_timestamps on public.worker_tasks;
create trigger trg_worker_tasks_sync_timestamps
before update on public.worker_tasks
for each row
execute function public.sync_worker_task_completed_at();

create or replace function public.sync_worker_task_item_completed_at()
returns trigger
language plpgsql
as $$
begin
  if new.status in ('succeeded','failed','cancelled') and new.completed_at is null then
    new.completed_at := now();
  end if;
  if new.status = 'running' and new.started_at is null then
    new.started_at := now();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_worker_task_items_sync_timestamps on public.worker_task_items;
create trigger trg_worker_task_items_sync_timestamps
before update on public.worker_task_items
for each row
execute function public.sync_worker_task_item_completed_at();

commit;

-- Verify
select
  to_regclass('public.worker_tasks') is not null as has_worker_tasks,
  to_regclass('public.task_events') is not null as has_task_events,
  to_regclass('public.task_outputs') is not null as has_task_outputs,
  to_regclass('public.worker_task_items') is not null as has_worker_task_items;
