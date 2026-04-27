-- Worker baseline for Creative Xiaohai
-- Idempotent migration: safe to run multiple times.

begin;

create table if not exists public.worker_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
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

commit;

-- Verify
select
  to_regclass('public.worker_tasks') is not null as has_worker_tasks,
  to_regclass('public.task_events') is not null as has_task_events,
  to_regclass('public.task_outputs') is not null as has_task_outputs;
