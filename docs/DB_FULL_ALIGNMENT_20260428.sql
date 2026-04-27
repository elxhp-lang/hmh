-- Full alignment for DB <-> code contract (global scope, not only Xiaohai).
-- Idempotent where possible; run in one pass.

begin;

create extension if not exists pgcrypto;

-- 1) Missing tables
create table if not exists public.tag_definitions (
  id text primary key default gen_random_uuid()::text,
  name text not null unique,
  enabled boolean not null default true,
  created_by text references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create index if not exists idx_tag_definitions_name on public.tag_definitions(name);
create index if not exists idx_tag_definitions_enabled on public.tag_definitions(enabled);

create table if not exists public.real_assets (
  id uuid primary key default gen_random_uuid(),
  asset_id text not null unique,
  asset_url text,
  name text not null,
  description text,
  category text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_real_assets_name on public.real_assets(name);
create index if not exists idx_real_assets_category on public.real_assets(category);
create index if not exists idx_real_assets_status on public.real_assets(status);
create index if not exists idx_real_assets_updated_at on public.real_assets(updated_at desc);

-- 2) Missing columns
alter table if exists public.videos
  add column if not exists last_frame_url text;

-- 3) Backfill session linkage for null session messages
insert into public.agent_sessions (
  id,
  user_id,
  agent_type,
  title,
  status,
  message_count,
  last_message_at,
  created_at,
  updated_at
)
select
  gen_random_uuid()::text as id,
  u.user_id,
  'creative' as agent_type,
  '历史修复会话' as title,
  'active' as status,
  0 as message_count,
  now() as last_message_at,
  now() as created_at,
  now() as updated_at
from (
  select distinct m.user_id
  from public.agent_conversation_messages m
  left join public.agent_sessions s on s.user_id = m.user_id and s.agent_type = 'creative'
  where m.session_id is null and s.id is null
) u;

update public.agent_conversation_messages m
set session_id = (
  select s.id
  from public.agent_sessions s
  where s.user_id = m.user_id
    and s.agent_type = 'creative'
    and coalesce(s.created_at, now()) <= coalesce(m.created_at, now())
  order by s.created_at desc nulls last, s.last_message_at desc nulls last
  limit 1
)
where m.session_id is null;

update public.agent_conversation_messages m
set session_id = (
  select s.id
  from public.agent_sessions s
  where s.user_id = m.user_id
    and s.agent_type = 'creative'
  order by s.last_message_at desc nulls last, s.created_at desc nulls last
  limit 1
)
where m.session_id is null;

-- 4) Ensure counters/timestamps match message facts
with agg as (
  select
    m.session_id,
    count(*)::int as cnt,
    max(m.created_at) as last_at
  from public.agent_conversation_messages m
  where m.session_id is not null
  group by m.session_id
)
update public.agent_sessions s
set
  message_count = coalesce(a.cnt, 0),
  last_message_at = coalesce(a.last_at, s.last_message_at),
  updated_at = now()
from agg a
where s.id = a.session_id;

update public.agent_sessions s
set message_count = 0
where not exists (
  select 1
  from public.agent_conversation_messages m
  where m.session_id = s.id
)
and coalesce(s.message_count, 0) <> 0;

update public.agent_sessions s
set
  last_message_at = null,
  updated_at = now()
where not exists (
  select 1
  from public.agent_conversation_messages m
  where m.session_id = s.id
)
and s.last_message_at is not null;

-- 5) Normalize session ID column types to uuid
alter table if exists public.agent_conversation_messages
  drop constraint if exists agent_conversation_messages_session_id_fkey;
alter table if exists public.agent_conversations
  drop constraint if exists agent_conversations_session_id_fkey;
alter table if exists public.videos
  drop constraint if exists videos_session_id_fkey;

alter table public.agent_sessions
  alter column id type uuid using id::uuid;
alter table public.agent_sessions
  alter column id set default gen_random_uuid();

alter table public.agent_conversation_messages
  alter column session_id type uuid
  using case
    when session_id is null then null
    when session_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then session_id::uuid
    else null
  end;

alter table public.agent_conversations
  alter column session_id type uuid
  using case
    when session_id is null then null
    when session_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then session_id::uuid
    else null
  end;

alter table public.agent_conversation_messages
  add constraint agent_conversation_messages_session_id_fkey
  foreign key (session_id) references public.agent_sessions(id) on delete set null;

alter table public.agent_conversations
  add constraint agent_conversations_session_id_fkey
  foreign key (session_id) references public.agent_sessions(id) on delete set null;

alter table public.videos
  add constraint videos_session_id_fkey
  foreign key (session_id) references public.agent_sessions(id) on delete set null;

-- 6) High-value indexes for stability/perf
create index if not exists idx_agent_conv_msg_user_session_created
  on public.agent_conversation_messages(user_id, session_id, created_at);
create index if not exists idx_agent_sessions_user_last_message
  on public.agent_sessions(user_id, last_message_at desc);
create index if not exists idx_videos_user_session_created
  on public.videos(user_id, session_id, created_at desc);

commit;

-- 7) Verification block
select table_name
from information_schema.tables
where table_schema='public'
  and table_name in ('tag_definitions','real_assets')
order by table_name;

select table_name, column_name, data_type, udt_name
from information_schema.columns
where table_schema='public'
  and (
    (table_name='videos' and column_name='last_frame_url')
    or (table_name='agent_sessions' and column_name='id')
    or (table_name='agent_conversation_messages' and column_name='session_id')
  )
order by table_name, column_name;

with msg as (
  select session_id, count(*) as cnt, max(created_at) as last_at
  from public.agent_conversation_messages
  group by session_id
)
select
  (select count(*) from public.agent_conversation_messages where session_id is null) as null_session_messages,
  (select count(*) from public.agent_sessions s left join msg m on m.session_id=s.id where coalesce(s.message_count,0) <> coalesce(m.cnt,0)) as message_count_mismatch,
  (select count(*) from public.agent_sessions s left join msg m on m.session_id=s.id where coalesce(s.last_message_at, 'epoch'::timestamptz) <> coalesce(m.last_at, 'epoch'::timestamptz)) as last_message_at_mismatch,
  (select count(*) from public.videos v left join public.agent_sessions s on s.id=v.session_id where v.session_id is not null and s.id is null) as dangling_video_session_id;
