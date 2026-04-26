-- Track remix lineage for generated videos
alter table if exists public.videos
  add column if not exists source_video_id text,
  add column if not exists source_task_id text,
  add column if not exists is_remix boolean not null default false;

create index if not exists idx_videos_source_video_id on public.videos(source_video_id);
create index if not exists idx_videos_is_remix on public.videos(is_remix);
