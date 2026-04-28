/**
 * TOS 签名 URL 生成 API
 * 
 * 功能：生成访问签名 URL（GET 方法）
 * 
 * POST /api/tos/sign
 * 
 * 请求体：
 * {
 *   key: string;      // TOS key
 *   expires?: number; // 有效期（秒），默认 3600
 * }
 * 
 * 返回：
 * {
 *   url: string;      // 签名 URL
 *   expiresIn: number; // 有效期
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
    const { key, expires = 3600 } = body;

    if (!key) {
      return NextResponse.json(
        { error: 'key 不能为空' },
        { status: 400 }
      );
    }

    // 生成签名 URL
    const signedUrl = await VideoStorageService.getVideoUrl(key, expires);

    console.log(`[TOS签名] 生成访问 URL: key=${key}, expires=${expires}s`);

    return NextResponse.json({
      success: true,
      url: signedUrl,
      expiresIn: expires,
    });

  } catch (error) {
    console.error('[TOS签名] 错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '生成签名 URL 失败' },
      { status: 500 }
    );
  }
}
