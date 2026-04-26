/**
 * 财务助手历史记录 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '100');

  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('finance_conversation_messages')  // 财务助手专用表
      .select('*')
      .eq('user_id', user.userId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      throw new Error(`查询失败: ${error.message}`);
    }

    const messages = (data || []).map((msg) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      timestamp: msg.created_at,
    }));

    return NextResponse.json({ messages });
  } catch (error) {
    console.error('查询历史失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '服务器错误' },
      { status: 500 }
    );
  }
}
