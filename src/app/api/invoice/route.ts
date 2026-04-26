import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * 发票申请 API
 * POST /api/invoice
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };

    const body = await request.json();
    const { amount, title, taxNumber, address, bankInfo, email } = body;

    if (!amount || !title || !taxNumber) {
      return NextResponse.json({ error: '请填写必填项：金额、抬头、税号' }, { status: 400 });
    }

    const client = getSupabaseClient();

    const { data, error } = await client
      .from('invoices')
      .insert({
        user_id: decoded.userId,
        amount,
        title,
        tax_number: taxNumber,
        address: address || null,
        bank_info: bankInfo || null,
        email: email || null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      throw new Error(`申请失败: ${error.message}`);
    }

    return NextResponse.json({ success: true, invoice: data });
  } catch (error) {
    console.error('发票申请错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '申请失败' },
      { status: 500 }
    );
  }
}

/**
 * 查询发票列表
 * GET /api/invoice
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role: string };

    const client = getSupabaseClient();
    
    const isAdmin = ['super_admin', 'finance'].includes(decoded.role);
    
    let query = client
      .from('invoices')
      .select('*, users(username)')
      .order('created_at', { ascending: false })
      .limit(50);

    // 普通用户只能查看自己的发票
    if (!isAdmin) {
      query = query.eq('user_id', decoded.userId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`查询失败: ${error.message}`);
    }

    return NextResponse.json({ invoices: data });
  } catch (error) {
    console.error('查询发票错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '查询失败' },
      { status: 500 }
    );
  }
}
