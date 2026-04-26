import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * 获取个人统计数据
 * GET /api/stats/personal?user_id=xxx
 * 
 * 需要权限：用户只能查看自己的数据，super_admin 可查看所有
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role: string };

    const { searchParams } = new URL(request.url);
    let targetUserId = searchParams.get('user_id');

    // 权限检查：普通用户只能查看自己的数据
    if (decoded.role !== 'super_admin' && targetUserId !== decoded.userId) {
      targetUserId = decoded.userId;
    }

    // 如果没有指定 user_id，使用当前用户
    if (!targetUserId) {
      targetUserId = decoded.userId;
    }

    const client = getSupabaseClient();

    // 获取用户生成总量
    const { count: myVideos } = await client
      .from('videos')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', targetUserId);

    // 获取生成中的任务数
    const { count: myProcessing } = await client
      .from('videos')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', targetUserId)
      .eq('status', 'processing');

    // 获取已完成的任务数
    const { count: myCompleted } = await client
      .from('videos')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', targetUserId)
      .eq('status', 'completed');

    // 获取失败的任务数
    const { count: myFailed } = await client
      .from('videos')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', targetUserId)
      .eq('status', 'failed');

    return NextResponse.json({
      myVideos: myVideos || 0,
      myProcessing: myProcessing || 0,
      myCompleted: myCompleted || 0,
      myFailed: myFailed || 0,
    });
  } catch (error) {
    console.error('获取个人统计失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取数据失败' },
      { status: 500 }
    );
  }
}
