import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * 账单查询 API
 * GET /api/billing?page=1&pageSize=20
 */
export async function GET(request: NextRequest) {
  // 辅助函数：格式化金额（处理 BigNumber 等特殊格式）
  const formatAmount = (val: unknown): number => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const num = parseFloat(val);
      return isNaN(num) ? 0 : Math.round(num * 100) / 100;
    }
    // BigNumber 对象处理
    if (val && typeof val === 'object') {
      const obj = val as { toString?: () => string; c?: number[]; e?: number };
      if (obj.toString) {
        const str = obj.toString();
        const num = parseFloat(str);
        return isNaN(num) ? 0 : Math.round(num * 100) / 100;
      }
    }
    return 0;
  };

  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role: string };

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const userId = searchParams.get('userId'); // 管理员可查看所有用户

    const client = getSupabaseClient();
    
    // 判断权限：管理员可查看所有，普通用户只能查看自己
    const isAdmin = ['super_admin', 'admin', 'finance'].includes(decoded.role);

    // 构建查询
    let query = client
      .from('billing')
      .select('*', { count: 'exact' });

    // 非管理员只能查看自己的账单
    if (!isAdmin) {
      query = query.eq('user_id', decoded.userId);
    }

    // 查询账单
    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (error) {
      throw new Error(`查询失败: ${error.message}`);
    }

    // 获取用户名（如果有用户ID）
    let billsWithUsername = data || [];
    if (isAdmin && data && data.length > 0) {
      const userIds = [...new Set(data.map(b => b.user_id))];
      const { data: users } = await client
        .from('users')
        .select('id, username')
        .in('id', userIds);
      
      const userMap = new Map(users?.map(u => [u.id, u.username]) || []);
      billsWithUsername = data.map(b => ({
        ...b,
        amount: formatAmount(b.amount),
        users: { username: userMap.get(b.user_id) || '未知' }
      }));
    }

    // 计算总金额
    let totalAmount = 0;
    if (isAdmin) {
      const { data: totalData } = await client
        .from('billing')
        .select('amount');
      totalAmount = totalData?.reduce((sum, item) => sum + formatAmount(item.amount), 0) || 0;
    } else {
      const { data: totalData } = await client
        .from('billing')
        .select('amount')
        .eq('user_id', decoded.userId);
      totalAmount = totalData?.reduce((sum, item) => sum + formatAmount(item.amount), 0) || 0;
    }

    return NextResponse.json({
      bills: billsWithUsername,
      total: count,
      totalAmount,
      page,
      pageSize,
    });
  } catch (error) {
    console.error('查询账单错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '查询失败' },
      { status: 500 }
    );
  }
}
