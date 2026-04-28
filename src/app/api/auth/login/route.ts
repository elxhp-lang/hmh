import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
interface LoginUserRow {
  id: string;
  username: string;
  email?: string | null;
  role?: string | null;
  status?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  password_hash: string;
}
function isLoginUserRow(value: unknown): value is LoginUserRow {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === 'string' && typeof row.username === 'string' && typeof row.password_hash === 'string';
}

/**
 * 用户登录
 * POST /api/auth/login
 */
export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: '用户名和密码不能为空' },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    // 查询用户
    const { data: user, error: userError } = await client
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: '用户名或密码错误' },
        { status: 401 }
      );
    }

    // 检查用户状态
    if (user.status === 'pending') {
      return NextResponse.json(
        { error: '账号正在审核中，请等待管理员批准' },
        { status: 403 }
      );
    }

    if (user.status === 'disabled') {
      return NextResponse.json(
        { error: '账号已被禁用' },
        { status: 403 }
      );
    }

    // 验证密码
    if (!isLoginUserRow(user)) {
      return NextResponse.json({ error: '用户数据异常' }, { status: 500 });
    }
    const loginUser = user;
    const isValidPassword = await bcrypt.compare(password, loginUser.password_hash);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: '用户名或密码错误' },
        { status: 401 }
      );
    }

    // 生成 JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        username: user.username, 
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // 记录登录日志
    await client.from('operation_logs').insert({
      user_id: user.id,
      action: 'login',
      ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      details: { method: 'password' },
    });

    return NextResponse.json({
      token,
      user: {
        user_id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
      },
    });
  } catch (error) {
    console.error('登录错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '登录失败' },
      { status: 500 }
    );
  }
}
