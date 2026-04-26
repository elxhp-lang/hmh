/**
 * 创意小海文件上传 - Presign 模式
 * 
 * 功能：获取预签名上传 URL，让前端直接上传到 TOS
 * 
 * 流程：
 * 1. 前端请求 presign URL
 * 2. 前端用 PUT 请求直接上传文件到 TOS
 * 3. 返回永久公开 URL
 * 
 * POST /api/creative-agent/upload/presign
 * Body: { fileName: string, fileType: string, fileSize: number, fileCategory: 'video' | 'image' }
 * Response: { uploadUrl: string, fileKey: string, publicUrl: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTosClient, BUCKET_NAME } from '@/lib/tos-storage';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// 文件大小限制：视频 500MB，图片 10MB
const MAX_VIDEO_SIZE = 500 * 1024 * 1024;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

// 允许的文件类型
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo'];
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

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
    const { fileName, fileType, fileSize, fileCategory = 'video' } = body;

    // 验证参数
    if (!fileName || !fileType || !fileSize) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 验证文件类型和大小
    if (fileCategory === 'video') {
      if (!ALLOWED_VIDEO_TYPES.includes(fileType)) {
        return NextResponse.json({ error: '不支持的视频文件类型' }, { status: 400 });
      }
      if (fileSize > MAX_VIDEO_SIZE) {
        return NextResponse.json({ error: '视频大小不能超过 500MB' }, { status: 400 });
      }
    } else {
      if (!ALLOWED_IMAGE_TYPES.includes(fileType)) {
        return NextResponse.json({ error: '不支持的图片文件类型' }, { status: 400 });
      }
      if (fileSize > MAX_IMAGE_SIZE) {
        return NextResponse.json({ error: '图片大小不能超过 10MB' }, { status: 400 });
      }
    }

    // 生成唯一文件路径
    const timestamp = Date.now();
    const ext = fileName.split('.').pop() || 'mp4';
    const randomStr = Math.random().toString(36).substring(7);
    const fileKey = `users/${decoded.userId}/creative-agent/${fileCategory}/${timestamp}_${randomStr}.${ext}`;

    // 获取 TOS 客户端
    const client = getTosClient();

    // 生成预签名上传 URL（有效期 1 小时）
    const uploadUrl = await client.getPreSignedUrl({
      bucket: BUCKET_NAME,
      key: fileKey,
      method: 'PUT',
      expires: 3600,
    });

    // 永久公开 URL
    const publicUrl = `https://${BUCKET_NAME}.${process.env.TOS_ENDPOINT?.replace('https://', '') || 'tos-cn-beijing.volces.com'}/${fileKey}`;

    console.log(`[创意小海上传] 生成 presign URL: userId=${decoded.userId}, key=${fileKey}`);

    return NextResponse.json({
      uploadUrl,
      fileKey,
      publicUrl,
      expiresIn: 3600,
    });

  } catch (error) {
    console.error('[创意小海上传] presign 生成失败:', error);
    
    if (error instanceof jwt.JsonWebTokenError) {
      return NextResponse.json({ error: '登录已过期' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取上传地址失败' },
      { status: 500 }
    );
  }
}
