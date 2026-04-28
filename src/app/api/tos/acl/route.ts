/**
 * TOS 对象 ACL 设置 API
 * 
 * 功能：设置对象为公开读取
 * 
 * POST /api/tos/acl
 * 
 * 请求体：
 * {
 *   key: string;      // TOS key
 *   acl?: string;     // ACL 类型，默认 'public-read'
 * }
 * 
 * 返回：
 * {
 *   success: boolean;
 *   key: string;
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { VideoStorageService } from '@/lib/tos-storage';
import { getUserFromRequest } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }
    if (!['super_admin', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const body = await request.json();
    const { key, acl = 'public-read' } = body;

    if (!key) {
      return NextResponse.json(
        { error: 'key 不能为空' },
        { status: 400 }
      );
    }

    console.log(`[TOS ACL] 设置 ${key} 为 ${acl}`);

    // 设置 ACL
    const success = await VideoStorageService.setPublicRead(key);

    if (!success) {
      // 可能需要管理员权限，尝试另一种方式
      console.log(`[TOS ACL] 使用备选方式设置...`);
      // 这里可以添加其他设置方式
    }

    return NextResponse.json({
      success,
      key,
      acl,
    });

  } catch (error) {
    console.error('[TOS ACL] 错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '设置 ACL 失败' },
      { status: 500 }
    );
  }
}
