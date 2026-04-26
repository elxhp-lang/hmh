import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * 标记通知为已读 API
 * POST /api/notifications/read
 * 
 * 请求体：
 * - id: 通知ID
 * - all: 是否标记全部（true/false）
 */
export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role: string };

    const body = await request.json();
    const { id, all } = body;

    const client = getSupabaseClient();

    if (all === true) {
      // 标记全部为已读
      const { error } = await client
        .from('user_notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString()
        })
        .eq('user_id', decoded.userId)
        .eq('is_read', false);

      if (error) {
        console.error('[Notifications API] 标记全部已读失败:', error);
        return NextResponse.json({ error: '标记失败' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: '全部通知已标记为已读'
      });

    } else if (id) {
      // 标记单个通知为已读
      const { error } = await client
        .from('user_notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', decoded.userId);  // 确保只能标记自己的通知

      if (error) {
        console.error('[Notifications API] 标记已读失败:', error);
        return NextResponse.json({ error: '标记失败' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: '通知已标记为已读'
      });

    } else {
      return NextResponse.json({ error: '缺少参数' }, { status: 400 });
    }

  } catch (error) {
    console.error('[Notifications API] 错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
