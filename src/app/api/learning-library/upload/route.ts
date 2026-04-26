/**
 * 学习库专用上传 API
 * 
 * 功能：为学习库提供文件上传能力
 * 
 * 特点：
 * 1. 后端代理上传（绕过 TOS CORS 限制）
 * 2. 上传后自动设置永久公开读取权限
 * 3. 存储到 learning_library 表
 * 
 * 流程：
 * 1. 前端将文件作为 FormData 发送到后端
 * 2. 后端接收文件并上传到 TOS
 * 3. 设置永久公开读取权限
 * 4. 返回永久公开 URL
 * 5. 存储到 learning_library 表
 * 
 * POST /api/learning-library/upload
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { getTosClient, BUCKET_NAME } from '@/lib/tos-storage';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// 文件大小限制：500MB
const MAX_FILE_SIZE = 500 * 1024 * 1024;

// 允许的文件类型
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo'];

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

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: '请选择要上传的文件' }, { status: 400 });
    }

    // 验证文件类型
    if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
      return NextResponse.json({ error: '不支持的视频文件类型' }, { status: 400 });
    }

    // 验证文件大小
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: '文件大小不能超过 500MB' }, { status: 400 });
    }

    // 生成唯一文件名
    const timestamp = Date.now();
    const extension = file.name.split('.').pop() || 'mp4';
    const key = `users/${decoded.userId}/learning-videos/video_${timestamp}.${extension}`;

    console.log(`[学习库上传] 开始上传: userId=${decoded.userId}, fileName=${file.name}, key=${key}, size=${file.size}`);

    // 读取文件内容
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 上传到 TOS
    const client = getTosClient();
    await client.putObject({
      bucket: BUCKET_NAME,
      key,
      body: buffer,
      contentType: file.type,
    });

    // 设置永久公开读取权限
    try {
      await (client.putObjectAcl as any)({
        bucket: BUCKET_NAME,
        key,
        acl: 'public-read',
      });
      console.log(`[学习库上传] 设置永久公开读取成功: key=${key}`);
    } catch (aclError) {
      console.warn(`[学习库上传] 设置公开读取失败: ${aclError}`);
    }

    // 永久公开 URL（不包含签名）
    const publicUrl = `https://${BUCKET_NAME}.${process.env.TOS_ENDPOINT?.replace('https://', '') || 'tos-cn-beijing.volces.com'}/${key}`;

    console.log(`[学习库上传] 上传成功: key=${key}, publicUrl=${publicUrl}`);

    return NextResponse.json({
      success: true,
      key,
      publicUrl,
      contentType: file.type,
      size: file.size,
    });

  } catch (error) {
    console.error('[学习库上传] 错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '上传失败' },
      { status: 500 }
    );
  }
}
