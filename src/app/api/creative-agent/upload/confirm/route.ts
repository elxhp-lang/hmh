/**
 * 创意小海文件上传 - 确认上传完成
 * 
 * 功能：前端上传完成后调用，设置文件为公开读取
 * 
 * POST /api/creative-agent/upload/confirm
 * Body: { fileKey: string }
 * Response: { success: boolean, publicUrl: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTosClient, BUCKET_NAME } from '@/lib/tos-storage';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

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
    const { fileKey } = body;

    if (!fileKey) {
      return NextResponse.json({ error: '缺少 fileKey' }, { status: 400 });
    }

    // 验证文件路径属于当前用户（安全检查）
    const expectedPrefix = `users/${decoded.userId}/creative-agent/`;
    if (!fileKey.startsWith(expectedPrefix)) {
      return NextResponse.json({ error: '非法文件路径' }, { status: 403 });
    }

    // 设置文件为公开读取
    const client = getTosClient();
    await (client.putObjectAcl as any)({
      bucket: BUCKET_NAME,
      key: fileKey,
      acl: 'public-read',
    });

    // 生成公开 URL
    const publicUrl = `https://${BUCKET_NAME}.${process.env.TOS_ENDPOINT?.replace('https://', '') || 'tos-cn-beijing.volces.com'}/${fileKey}`;

    console.log(`[创意小海上传] 确认上传完成并设置公开: userId=${decoded.userId}, key=${fileKey}`);

    return NextResponse.json({
      success: true,
      publicUrl,
    });

  } catch (error) {
    console.error('[创意小海上传] 确认上传失败:', error);
    
    if (error instanceof jwt.JsonWebTokenError) {
      return NextResponse.json({ error: '登录已过期' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '确认上传失败' },
      { status: 500 }
    );
  }
}
