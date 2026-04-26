import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * 获取团队统计数据
 * GET /api/stats/team
 * 
 * 需要权限：super_admin 或 material_leader
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role: string };

    // 权限检查
    if (!['super_admin', 'material_leader'].includes(decoded.role)) {
      return NextResponse.json({ error: '无权访问' }, { status: 403 });
    }

    const client = getSupabaseClient();

    // 获取团队生成总量（所有素材相关角色的视频）
    const { count: teamVideos } = await client
      .from('videos')
      .select('*', { count: 'exact', head: true });

    // 获取生成中的任务数
    const { count: processingCount } = await client
      .from('videos')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'processing');

    // 获取团队人数（仅统计 material_member 角色）
    const { count: teamMembers } = await client
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'material_member');

    // 获取团队成员详情（仅 material_member 角色）
    const { data: members } = await client
      .from('users')
      .select('user_id, username, email, created_at')
      .eq('role', 'material_member')
      .order('created_at', { ascending: false })
      .limit(20);

    // 获取每个成员的视频生成数量
    const memberStats = await Promise.all(
      (members || []).map(async (member) => {
        const { count: videoCount } = await client
          .from('videos')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', member.user_id);

        const { count: processingCount } = await client
          .from('videos')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', member.user_id)
          .eq('status', 'processing');

        return {
          user_id: member.user_id,
          username: member.username,
          email: member.email,
          created_at: member.created_at,
          video_count: videoCount || 0,
          processing_count: processingCount || 0,
        };
      })
    );

    // 计算成功率
    const { count: completedCount } = await client
      .from('videos')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed');

    const { count: failedCount } = await client
      .from('videos')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed');

    const totalFinished = (completedCount || 0) + (failedCount || 0);
    const successRate = totalFinished > 0 
      ? Math.round(((completedCount || 0) / totalFinished) * 100) + '%'
      : '0%';

    return NextResponse.json({
      teamVideos: teamVideos || 0,
      processingCount: processingCount || 0,
      teamMembers: teamMembers || 0,
      successRate,
      members: memberStats,
    });
  } catch (error) {
    console.error('获取团队统计失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取数据失败' },
      { status: 500 }
    );
  }
}
