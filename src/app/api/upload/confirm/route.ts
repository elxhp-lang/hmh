/**
 * 通用文件上传 - 确认上传完成
 * 
 * 功能：前端上传完成后调用，设置文件为公开读取
 * 
 * POST /api/upload/confirm
 * Body: { key: string }
 * Response: { success: boolean, publicUrl: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTosClient, BUCKET_NAME } from '@/lib/tos-storage';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
type TosAclSetter = (params: { bucket: string; key: string; acl: 'public-read' }) => Promise<unknown>;

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; username: string };

    const body = await request.json();
    const { key } = body;

    if (!key) {
      return NextResponse.json({ error: '缺少 key' }, { status: 400 });
    }

    // 验证文件路径属于当前用户（安全检查）
    const expectedPrefix = `users/${decoded.userId}/`;
    if (!key.startsWith(expectedPrefix)) {
      return NextResponse.json({ error: '非法文件路径' }, { status: 403 });
    }

    // 设置文件为公开读取
    const client = getTosClient();
    try {
      await (client.putObjectAcl as TosAclSetter)({
        bucket: BUCKET_NAME,
        key: key,
        acl: 'public-read',
      });
    } catch (aclError) {
      console.warn('[上传确认] 设置公开权限失败，继续使用原 URL:', aclError);
    }

    // 生成公开 URL
    const publicUrl = `https://${BUCKET_NAME}.tos-cn-beijing.volces.com/${key}`;

    console.log(`[上传确认] 设置公开: userId=${decoded.userId}, key=${key}`);

    return NextResponse.json({
      success: true,
      publicUrl,
    });

  } catch (error) {
    console.error('[上传确认] 失败:', error);
    
    if (error instanceof jwt.JsonWebTokenError) {
      return NextResponse.json({ error: '登录已过期' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '确认上传失败' },
      { status: 500 }
    );
  }
}
