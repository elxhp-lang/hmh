-- Backfill public_video_url conservatively without breaking legacy records.
-- Strategy:
-- 1) Ensure column exists.
-- 2) Backfill only when result_url looks like a stable public URL (no TOS signed query markers).

alter table public.videos
  add column if not exists public_video_url text;

update public.videos
set public_video_url = result_url
where public_video_url is null
  and result_url is not null
  and result_url like 'http%'
  and position('?X-Tos-Algorithm=' in result_url) = 0
  and position('&X-Tos-Algorithm=' in result_url) = 0
  and position('X-Amz-Algorithm=' in result_url) = 0;

create index if not exists idx_videos_public_video_url
  on public.videos(public_video_url);
