import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
interface VideoStatusRow {
  status?: string;
}

/**
 * 仪表盘统计概览 API
 * GET /api/stats/overview
 */
export async function GET(request: NextRequest) {
  // 辅助函数：格式化金额（处理 BigNumber 等特殊格式）
  const formatAmount = (val: unknown): number => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const num = parseFloat(val);
      return isNaN(num) ? 0 : num;
    }
    if (val && typeof val === 'object' && typeof (val as { toString?: () => string }).toString === 'function') {
      const str = (val as { toString: () => string }).toString();
      const num = parseFloat(str);
      return isNaN(num) ? 0 : num;
    }
    return 0;
  };

  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      role: string;
    };

    const client = getSupabaseClient();
    const isAdmin = ['super_admin', 'admin'].includes(decoded.role);

    // 用户视频统计
    const { data: videoStats, error: videoError } = await client
      .from('videos')
      .select('status', { count: 'exact', head: false })
      .eq('user_id', decoded.userId);

    if (videoError) {
      throw new Error(`查询视频统计失败: ${videoError.message}`);
    }

    const rows = (videoStats || []) as VideoStatusRow[];
    const totalVideos = rows.length || 0;
    const pendingVideos = rows.filter((v) => v.status === 'processing').length || 0;

    // 用户消费统计
    const { data: billingStats, error: billingError } = await client
      .from('billing')
      .select('amount')
      .eq('user_id', decoded.userId);

    if (billingError) {
      throw new Error(`查询账单统计失败: ${billingError.message}`);
    }

    const totalAmount = billingStats?.reduce((sum: number, b) => sum + formatAmount(b.amount), 0) || 0;

    const response: Record<string, unknown> = {
      total_videos: totalVideos,
      pending_videos: pendingVideos,
      total_amount: totalAmount.toFixed(2),
    };

    // 管理员额外统计
    if (isAdmin) {
      // 用户总数
      const { count: totalUsers, error: userError } = await client
        .from('users')
        .select('*', { count: 'exact', head: true });

      if (!userError) {
        response.total_users = totalUsers || 0;
      }

      // 本月消费
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const { data: monthlyBilling, error: monthlyError } = await client
        .from('billing')
        .select('amount')
        .gte('created_at', monthStart);

      if (!monthlyError) {
        const monthlyAmount = monthlyBilling?.reduce((sum: number, b) => sum + formatAmount(b.amount), 0) || 0;
        response.monthly_amount = monthlyAmount.toFixed(2);
      }
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('查询统计概览错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '查询失败' },
      { status: 500 }
    );
  }
}
