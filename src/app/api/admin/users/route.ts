import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * 用户管理 API
 * 仅管理员可访问
 */

/**
 * 获取用户列表
 * GET /api/admin/users
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { role: string };

    // 仅超级管理员可访问
    if (decoded.role !== 'super_admin') {
      return NextResponse.json({ error: '无权限' }, { status: 403 });
    }

    const client = getSupabaseClient();

    const { data, error } = await client
      .from('users')
      .select('id, username, email, role, status, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`查询失败: ${error.message}`);
    }

    // 将 id 映射为 user_id 返回给前端
    const users = (data || []).map(user => ({
      user_id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.status,
      created_at: user.created_at,
    }));

    return NextResponse.json({ users });
  } catch (error) {
    console.error('查询用户错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '查询失败' },
      { status: 500 }
    );
  }
}

/**
 * 更新用户状态
 * PUT /api/admin/users/[id]/status
 */
export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { role: string; userId: string };

    if (decoded.role !== 'super_admin') {
      return NextResponse.json({ error: '无权限' }, { status: 403 });
    }

    const body = await request.json();
    const { userId, status, role } = body;

    const client = getSupabaseClient();

    const updateData: { status?: string; role?: string; updated_at: string } = { updated_at: new Date().toISOString() };
    if (status) updateData.status = status;
    if (role) updateData.role = role;

    const { error } = await client
      .from('users')
      .update(updateData)
      .eq('id', userId);

    if (error) {
      throw new Error(`更新失败: ${error.message}`);
    }

    // 记录操作日志
    await client.from('operation_logs').insert({
      user_id: decoded.userId,
      action: 'user_status_update',
      details: { target_user_id: userId, status, role },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('更新用户状态错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '更新失败' },
      { status: 500 }
    );
  }
}
