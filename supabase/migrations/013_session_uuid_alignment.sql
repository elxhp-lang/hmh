-- Normalize agent session identifiers to UUID in a deploy-safe way.
-- This migration is idempotent and only converts text/varchar columns when needed.

begin;

alter table if exists public.agent_conversations
  drop constraint if exists agent_conversations_session_id_fkey;

do $$
declare
  session_id_type text;
begin
  select data_type into session_id_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'agent_conversations'
    and column_name = 'session_id';

  if session_id_type in ('character varying', 'text') then
    update public.agent_conversations
    set session_id = null
    where session_id is not null
      and not (
        session_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      );

    alter table public.agent_conversations
      alter column session_id type uuid
      using nullif(session_id, '')::uuid;
  end if;
end $$;

do $$
declare
  session_pk_type text;
begin
  select data_type into session_pk_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'agent_sessions'
    and column_name = 'id';

  if session_pk_type in ('character varying', 'text') then
    alter table public.agent_sessions
      alter column id drop default;

    alter table public.agent_sessions
      alter column id type uuid
      using id::uuid;

    alter table public.agent_sessions
      alter column id set default gen_random_uuid();
  end if;
end $$;

alter table if exists public.agent_conversations
  add constraint agent_conversations_session_id_fkey
  foreign key (session_id)
  references public.agent_sessions(id)
  on delete set null;

commit;
