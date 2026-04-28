import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import bcrypt from 'bcryptjs';
import { sendRegisterApprovalNotification } from '@/lib/feishu-webhook';
interface RegisteredUserRow {
  id: string;
  username: string;
  created_at: string;
}
function isRegisteredUserRow(value: unknown): value is RegisteredUserRow {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === 'string' && typeof row.username === 'string' && typeof row.created_at === 'string';
}

/**
 * 用户注册
 * POST /api/auth/register
 * 
 * 注册成功后自动创建用户存储路径
 * 非首个用户需要管理员审核
 */
export async function POST(request: NextRequest) {
  try {
    const { username, password, email } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: '用户名和密码不能为空' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: '密码至少需要6位' },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    // 检查用户名是否已存在
    const { data: existingUser, error: checkError } = await client
      .from('users')
      .select('id, status')
      .eq('username', username)
      .maybeSingle();

    if (checkError) {
      throw new Error(`检查用户失败: ${checkError.message}`);
    }

    if (existingUser) {
      // 如果用户已存在且状态为 pending，提示审核中
      if (existingUser.status === 'pending') {
        return NextResponse.json(
          { error: '该用户注册申请审核中，请稍后', pending: true },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: '用户名已存在' },
        { status: 400 }
      );
    }

    // 检查是否是第一个用户
    const { count: userCount } = await client
      .from('users')
      .select('*');

    if (userCount === undefined || userCount === null) {
      throw new Error('检查用户数量失败');
    }

    const isFirstUser = userCount === 0;
    const role = isFirstUser ? 'super_admin' : 'material_member';
    const status = isFirstUser ? 'active' : 'pending';

    // 加密密码
    const passwordHash = await bcrypt.hash(password, 10);

    // 生成用户存储路径
    // 使用时间戳 + 随机字符串确保唯一性
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const storagePath = `users/${timestamp}_${randomSuffix}`;

    // 创建用户
    const { data: user, error: insertError } = await client
      .from('users')
      .insert({
        username,
        password_hash: passwordHash,
        email: email || null,
        role,
        status,
        storage_path: storagePath,
        storage_quota: 10737418240, // 10GB
        storage_used: 0,
      })
      .select('id, username, email, role, status, storage_path, created_at')
      .single();

    if (insertError) {
      throw new Error(`创建用户失败: ${insertError.message}`);
    }

    console.log(`[Register] 用户 ${username} 注册成功，存储路径: ${storagePath}`);

    // 非首个用户发送飞书审核通知
    if (!isFirstUser && isRegisteredUserRow(user)) {
      const registeredUser = user;
      // 异步发送通知，不阻塞注册流程
      sendRegisterApprovalNotification({
        username: registeredUser.username,
        user_id: registeredUser.id,
        registered_at: new Date(registeredUser.created_at).toLocaleString('zh-CN'),
      }).catch(err => {
        console.error('发送飞书审核通知失败:', err);
      });
    }

    return NextResponse.json({
      success: isFirstUser ? '注册成功，您是第一个用户，已自动成为超级管理员' : '注册成功，等待管理员审核',
      user,
      needApproval: !isFirstUser,
      storage: {
        path: storagePath,
        quota: '10GB',
      },
    });
  } catch (error) {
    console.error('注册错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '注册失败' },
      { status: 500 }
    );
  }
}
