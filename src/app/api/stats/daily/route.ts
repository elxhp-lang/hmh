import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
interface BillingDailyRow {
  created_at?: string;
  task_type?: string;
  amount?: unknown;
}

/**
 * 每日消费统计 API
 * GET /api/stats/daily?startDate=2024-01-01&endDate=2024-01-31
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
    const decoded = jwt.verify(token, JWT_SECRET) as { role: string };

    // 仅管理员和财务可访问
    if (!['super_admin', 'finance'].includes(decoded.role)) {
      return NextResponse.json({ error: '无权限' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0];

    const client = getSupabaseClient();

    // 查询账单数据并按日期分组
    const { data, error } = await client
      .from('billing')
      .select('created_at, amount, task_type')
      .gte('created_at', startDate)
      .lte('created_at', `${endDate}T23:59:59`)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`查询失败: ${error.message}`);
    }

    // 按日期和类型统计
    const statsMap = new Map<string, { date: string; category: string; amount: number; tasks: number }>();

    ((data || []) as BillingDailyRow[]).forEach((item) => {
      const date = item.created_at?.split('T')[0] || '';
      const category = item.task_type || 'other';
      const key = `${date}_${category}`;

      if (!statsMap.has(key)) {
        statsMap.set(key, {
          date,
          category,
          amount: 0,
          tasks: 0,
        });
      }

      const stat = statsMap.get(key)!;
      stat.amount += formatAmount(item.amount);
      stat.tasks += 1;
    });

    const stats = Array.from(statsMap.values()).map(stat => ({
      stat_date: stat.date,
      category: stat.category,
      total_amount: stat.amount,
      total_tasks: stat.tasks,
    }));

    // 计算总计
    const totalAmount = stats.reduce((sum, s) => sum + s.total_amount, 0);
    const totalTasks = stats.reduce((sum, s) => sum + s.total_tasks, 0);

    return NextResponse.json({
      stats,
      summary: {
        total_amount: totalAmount,
        total_tasks: totalTasks,
        date_range: { start: startDate, end: endDate },
      },
    });
  } catch (error) {
    console.error('查询统计错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '查询失败' },
      { status: 500 }
    );
  }
}
