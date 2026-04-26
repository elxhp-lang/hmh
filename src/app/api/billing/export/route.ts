import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * 导出账单明细为 CSV
 * GET /api/billing/export
 * 
 * 需要权限：super_admin 或 finance
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
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role: string };

    // 权限检查
    if (!['super_admin', 'finance'].includes(decoded.role)) {
      return NextResponse.json({ error: '无权访问' }, { status: 403 });
    }

    const client = getSupabaseClient();

    // 获取账单数据
    const { data: bills, error } = await client
      .from('billing')
      .select(`
        id,
        user_id,
        video_id,
        amount,
        task_type,
        description,
        created_at,
        users!inner(username)
      `)
      .order('created_at', { ascending: false })
      .limit(1000);

    if (error) {
      throw new Error(`查询失败: ${error.message}`);
    }

    // 生成 CSV 内容
    const headers = ['账单ID', '用户名', '任务类型', '金额(元)', '描述', '创建时间'];
    const csvRows = [headers.join(',')];

    for (const bill of bills || []) {
      // 处理 Supabase 返回的 users 字段（可能是对象或数组）
      let username = '-';
      if (bill.users) {
        if (Array.isArray(bill.users)) {
          username = bill.users[0]?.username || '-';
        } else if (typeof bill.users === 'object') {
          username = (bill.users as { username: string }).username || '-';
        }
      }
      
      const row = [
        bill.id,
        username,
        bill.task_type || '-',
        formatAmount(bill.amount).toFixed(2),
        `"${((bill.description as string) || '').replace(/"/g, '""')}"`, // 转义引号
        new Date(bill.created_at as string).toLocaleString('zh-CN'),
      ];
      csvRows.push(row.join(','));
    }

    const csvContent = csvRows.join('\n');

    // 添加 BOM 以支持中文
    const bom = '\uFEFF';
    const csvWithBom = bom + csvContent;

    return new NextResponse(csvWithBom, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="billing-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error('导出账单失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '导出失败' },
      { status: 500 }
    );
  }
}
