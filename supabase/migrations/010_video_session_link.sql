-- Link videos with agent sessions for continuity and recovery
alter table if exists public.videos
  add column if not exists session_id text references public.agent_sessions(id) on delete set null;

create index if not exists idx_videos_session_id on public.videos(session_id);
