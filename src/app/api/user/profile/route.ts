import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * 获取用户信息
 * GET /api/user/profile
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    
    const client = getSupabaseClient();
    
    const { data: user, error } = await client
      .from('users')
      .select('id, username, email, role, status, created_at, storage_path, display_name, avatar_url')
      .eq('id', decoded.userId)
      .single();

    if (error || !user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('获取用户信息错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取失败' },
      { status: 500 }
    );
  }
}

/**
 * 更新用户信息
 * PATCH /api/user/profile
 */
export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    
    const body = await request.json();
    const { display_name, avatar_url } = body;

    // 验证输入
    if (display_name !== undefined) {
      if (typeof display_name !== 'string') {
        return NextResponse.json({ error: '显示名称必须是字符串' }, { status: 400 });
      }
      if (display_name.length > 50) {
        return NextResponse.json({ error: '显示名称不能超过50个字符' }, { status: 400 });
      }
    }

    const client = getSupabaseClient();
    
    // 构建更新对象
    const updateData: Record<string, unknown> = {};
    if (display_name !== undefined) updateData.display_name = display_name;
    if (avatar_url !== undefined) updateData.avatar_url = avatar_url;
    
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: '没有需要更新的内容' }, { status: 400 });
    }

    updateData.updated_at = new Date().toISOString();

    // 更新用户信息
    const { error } = await client
      .from('users')
      .update(updateData)
      .eq('id', decoded.userId);

    if (error) {
      console.error('更新用户信息错误:', error);
      return NextResponse.json({ error: '更新失败' }, { status: 500 });
    }

    // 记录操作日志
    await client.from('operation_logs').insert({
      user_id: decoded.userId,
      action: 'update_profile',
      details: { fields: Object.keys(updateData) },
    });

    return NextResponse.json({ 
      success: true,
      message: '更新成功'
    });
  } catch (error) {
    console.error('更新用户信息错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '更新失败' },
      { status: 500 }
    );
  }
}
