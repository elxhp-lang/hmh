-- Video tag system: auto tagging status + customizable tag pool
alter table if exists public.videos
  add column if not exists tag_source text default 'manual',
  add column if not exists auto_tag_status text default 'pending';

create index if not exists idx_videos_tag_source on public.videos(tag_source);
create index if not exists idx_videos_auto_tag_status on public.videos(auto_tag_status);

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

insert into public.tag_definitions (name)
values
  ('开箱'),
  ('测评'),
  ('参数科普'),
  ('热点解读'),
  ('种草'),
  ('剧情'),
  ('教程'),
  ('对比'),
  ('Vlog'),
  ('口播')
on conflict (name) do nothing;
