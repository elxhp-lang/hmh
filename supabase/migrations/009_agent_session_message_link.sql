-- Link agent conversation messages to agent_sessions for long-lived session management
alter table if exists public.agent_conversation_messages
  add column if not exists session_id text references public.agent_sessions(id) on delete set null;

create index if not exists idx_conv_messages_session on public.agent_conversation_messages(session_id);
create index if not exists idx_agent_sessions_user_agent on public.agent_sessions(user_id, agent_type);
