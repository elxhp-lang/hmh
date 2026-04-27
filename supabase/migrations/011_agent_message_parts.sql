-- 为对话消息增加富内容片段存储（message parts）
alter table if exists public.agent_conversation_messages
  add column if not exists parts jsonb;

comment on column public.agent_conversation_messages.parts
  is 'Structured message parts for rich rendering (table/image/video/card)';
