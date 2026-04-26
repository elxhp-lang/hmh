import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * 消息通知列表 API
 * GET /api/notifications
 * 
 * 参数：
 * - page: 页码（默认1）
 * - limit: 每页数量（默认20）
 * - is_read: 筛选已读/未读状态（true/false）
 * - type: 筛选通知类型（video_completed/video_failed/system_notice）
 */
export async function GET(request: NextRequest) {
  try {
    // 验证用户身份
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role: string };

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const isRead = searchParams.get('is_read');
    const type = searchParams.get('type');

    const client = getSupabaseClient();
    const offset = (page - 1) * limit;

    // 构建查询
    let query = client
      .from('user_notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', decoded.userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // 筛选已读状态
    if (isRead === 'true') {
      query = query.eq('is_read', true);
    } else if (isRead === 'false') {
      query = query.eq('is_read', false);
    }

    // 筛选类型
    if (type) {
      query = query.eq('notification_type', type);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('[Notifications API] 查询失败:', error);
      return NextResponse.json({ error: '查询失败' }, { status: 500 });
    }

    // 获取未读数量
    const { count: unreadCount } = await client
      .from('user_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', decoded.userId)
      .eq('is_read', false);

    return NextResponse.json({
      success: true,
      notifications: data || [],
      total: count || 0,
      unreadCount: unreadCount || 0,
      page,
      limit,
    });

  } catch (error) {
    console.error('[Notifications API] 错误:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
