import { NextRequest } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { fail, ok, requireAuth } from '@/lib/server/api-kit';

async function createCreativeSession(userId: string) {
  const supabase = getSupabaseClient();
  const { data: created, error } = await supabase
    .from('agent_sessions')
    .insert({
      user_id: userId,
      agent_type: 'creative',
      title: `创意会话 ${new Date().toLocaleString('zh-CN')}`,
      status: 'active',
      message_count: 0,
      last_message_at: new Date().toISOString(),
    })
    .select('id,user_id,agent_type,status,title,message_count,last_message_at,created_at')
    .single();
  if (error || !created) {
    throw new Error(`创建会话失败: ${error?.message || '未知错误'}`);
  }
  return created;
}

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth.response || !auth.user) return auth.response;
  const userId = auth.user.userId;
  const supabase = getSupabaseClient();
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    const { data: sessions } = await supabase
      .from('agent_sessions')
      .select('id,title,status,message_count,last_message_at,created_at')
      .eq('user_id', userId)
      .eq('agent_type', 'creative')
      .order('last_message_at', { ascending: false })
      .limit(100);
    return ok({ data: { sessions: sessions || [] } });
  }

  const { data: historyData } = await supabase
    .from('agent_conversation_messages')
    .select('*')
    .eq('user_id', userId)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  const { data: preferencesData } = await supabase
    .from('creative_user_preferences')
    .select('*')
    .eq('user_id', userId)
    .order('last_updated_at', { ascending: false });

  return ok({
    data: {
      conversationHistory: historyData || [],
      userPreferences: preferencesData || [],
      sessionId,
    },
  });
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (auth.response || !auth.user) return auth.response;
  const userId = auth.user.userId;

  const body = await request.json().catch(() => ({}));
  const action = typeof body?.action === 'string' ? body.action : 'create';
  if (action !== 'create') {
    return fail('unsupported_action', 400);
  }

  const session = await createCreativeSession(userId);
  return ok({ data: { session } });
}
