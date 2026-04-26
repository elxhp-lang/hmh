/**
 * 预签名上传 API
 * 
 * 功能：生成预签名上传 URL，前端可以直接上传到 TOS
 * 
 * 流程：
 * 1. 前端请求预签名上传 URL
 * 2. 前端直接 PUT 文件到 TOS
 * 3. 上传成功后设置公开读取权限（public-read ACL）
 * 4. 返回公开可访问的 URL
 * 
 * POST /api/upload/presign
 * 
 * 请求体：
 * {
 *   filename: string;              // 文件名
 *   fileType: 'video' | 'image';  // 文件类型
 *   userId?: string;              // 用户 ID（可选）
 *   expiresIn?: number;            // URL 有效期（秒）
 *                                       - 3600: 临时 URL（1小时，创意小海使用）
 *                                       - 0: 永久 URL（学习库使用）
 * }
 * 
 * 返回：
 * {
 *   uploadUrl: string;     // 预签名上传 URL
 *   key: string;           // TOS key
 *   publicUrl: string;     // 公开访问 URL
 *   expiresIn: number;     // 有效期（秒）
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTosClient, BUCKET_NAME, UserStorage } from '@/lib/tos-storage';
import jwt, { TokenExpiredError, JsonWebTokenError } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 公开上传函数，供其他模块调用
export async function generatePresignedUploadUrl(
  filename: string,
  fileType: 'video' | 'image',
  userId: string = 'anonymous',
  expiresIn: number = 3600  // 默认 1 小时临时 URL
) {
  // 生成唯一的 key
  const userStorage = new UserStorage(userId);
  const ext = filename.split('.').pop() || (fileType === 'video' ? 'mp4' : 'jpg');
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  
  const key = fileType === 'video'
    ? userStorage.getVideoPath(`${timestamp}_${randomStr}.${ext}`)
    : userStorage.getImagePath(`${timestamp}_${randomStr}.${ext}`);

  // 上传预签名 URL 有效期固定为 1 小时（用于上传操作）
  const uploadExpiresIn = 3600;
  const client = getTosClient();
  
  const uploadUrl = client.getPreSignedUrl({
    bucket: BUCKET_NAME,
    key: key,
    method: 'PUT',
    expires: uploadExpiresIn,
  });

  // 生成公开访问 URL
  const publicUrl = `https://${BUCKET_NAME}.tos-cn-beijing.volces.com/${key}`;

  return {
    uploadUrl,
    key,
    publicUrl,
    expiresIn,  // 返回给调用方的 URL 有效期
    uploadExpiresIn,  // 上传操作的有效期
    contentType: fileType === 'video' ? 'video/mp4' : 'image/jpeg',
  };
}

export async function POST(request: NextRequest) {
  try {
    // 验证用户身份并提取 userId
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    } catch (jwtError) {
      if (jwtError instanceof TokenExpiredError) {
        return NextResponse.json({ error: '登录已过期，请重新登录' }, { status: 401 });
      }
      if (jwtError instanceof JsonWebTokenError) {
        return NextResponse.json({ error: '无效的登录凭证' }, { status: 401 });
      }
      throw jwtError;
    }

    const body = await request.json();
    const { 
      filename, 
      fileType = 'video', 
      expiresIn = 3600  // 默认 1 小时（创意小海使用）
    } = body;

    // 使用 token 中的 userId，而不是信任前端传入的 userId
    const userId = decoded.userId;

    if (!filename) {
      return NextResponse.json(
        { error: 'filename 不能为空' },
        { status: 400 }
      );
    }

    // 验证文件类型
    const allowedTypes = ['video', 'image'];
    if (!allowedTypes.includes(fileType)) {
      return NextResponse.json(
        { error: 'fileType 必须是 video 或 image' },
        { status: 400 }
      );
    }

    const result = await generatePresignedUploadUrl(filename, fileType, userId, expiresIn);
    
    console.log(`[预签名上传] 用户 ${userId} 上传文件: key=${result.key}, expiresIn=${expiresIn}s`);

    return NextResponse.json({
      success: true,
      ...result,
    });

  } catch (error) {
    console.error('[预签名上传] 错误:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '生成预签名 URL 失败' },
      { status: 500 }
    );
  }
}
