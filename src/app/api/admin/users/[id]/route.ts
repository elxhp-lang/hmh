import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * 更新用户信息
 * PUT /api/admin/users/[id]
 * 
 * 路径参数: id - 用户ID
 * 请求体: { role?: string, status?: string }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { role: string; userId: string };

    // 仅超级管理员可访问
    if (decoded.role !== 'super_admin') {
      return NextResponse.json({ error: '无权限' }, { status: 403 });
    }

    const { id: targetUserId } = await params;
    const body = await request.json();
    const { role, status } = body;

    if (!role && !status) {
      return NextResponse.json({ error: '请提供要更新的字段' }, { status: 400 });
    }

    const client = getSupabaseClient();

    // 构建更新数据
    const updateData: { role?: string; status?: string; updated_at: string } = {
      updated_at: new Date().toISOString()
    };
    if (role) updateData.role = role;
    if (status) updateData.status = status;

    // 执行更新
    const { error } = await client
      .from('users')
      .update(updateData)
      .eq('id', targetUserId);

    if (error) {
      throw new Error(`更新失败: ${error.message}`);
    }

    // 记录操作日志
    await client.from('operation_logs').insert({
      user_id: decoded.userId,
      operation_type: 'user_update',
      operation_detail: { target_user_id: targetUserId, role, status },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('更新用户错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '更新失败' },
      { status: 500 }
    );
  }
}

/**
 * 获取单个用户信息
 * GET /api/admin/users/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: targetUserId } = await params;
    const client = getSupabaseClient();

    const { data, error } = await client
      .from('users')
      .select('id, username, email, role, status, created_at, updated_at')
      .eq('id', targetUserId)
      .single();

    if (error) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    return NextResponse.json({ user: data });
  } catch (error) {
    console.error('查询用户错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '查询失败' },
      { status: 500 }
    );
  }
}

/**
 * 删除用户
 * DELETE /api/admin/users/[id]
 * 
 * 路径参数: id - 用户ID
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { role: string; userId: string };

    // 仅超级管理员可访问
    if (decoded.role !== 'super_admin') {
      return NextResponse.json({ error: '无权限' }, { status: 403 });
    }

    const { id: targetUserId } = await params;
    const client = getSupabaseClient();

    // 查询用户
    const { data: user, error: userError } = await client
      .from('users')
      .select('id, username')
      .eq('id', targetUserId)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    // 不能删除自己
    if (targetUserId === decoded.userId) {
      return NextResponse.json({ error: '不能删除自己' }, { status: 400 });
    }

    // 删除用户（级联删除相关数据）
    const { error: deleteError } = await client
      .from('users')
      .delete()
      .eq('id', targetUserId);

    if (deleteError) {
      throw new Error(`删除失败: ${deleteError.message}`);
    }

    // 记录操作日志
    await client.from('operation_logs').insert({
      user_id: decoded.userId,
      operation_type: 'user_delete',
      operation_detail: { deleted_user_id: targetUserId, deleted_username: user.username },
    });

    return NextResponse.json({ success: true, message: `用户 ${user.username} 已删除` });
  } catch (error) {
    console.error('删除用户错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '删除失败' },
      { status: 500 }
    );
  }
}
