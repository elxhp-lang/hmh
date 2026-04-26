import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { LearningLibraryStorage } from '@/lib/tos-storage';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * 获取预签名上传URL
 * 
 * POST /api/learning-library/presign
 * 
 * 请求体: { fileName: string, fileType: string, fileSize: number }
 * 返回: { uploadUrl: string, fileKey: string }
 */
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
    const { fileName, fileType, fileSize } = body;

    // 验证参数
    if (!fileName || !fileType || !fileSize) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 验证文件类型
    if (!fileType.startsWith('video/')) {
      return NextResponse.json({ error: '只支持视频文件' }, { status: 400 });
    }

    // 验证文件大小（最大 500MB）
    const maxSize = 500 * 1024 * 1024;
    if (fileSize > maxSize) {
      return NextResponse.json({ error: '视频大小超过限制（最大 500MB）' }, { status: 400 });
    }

    // 生成预签名上传URL
    const { uploadUrl, fileKey } = await LearningLibraryStorage.getPresignedUploadUrl(
      decoded.userId,
      fileName,
      fileType
    );

    return NextResponse.json({
      uploadUrl,
      fileKey,
      expiresIn: 3600, // 1小时有效
    });
  } catch (error) {
    console.error('获取预签名URL失败:', error);
    
    if (error instanceof jwt.JsonWebTokenError) {
      return NextResponse.json({ error: '登录已过期' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取上传地址失败' },
      { status: 500 }
    );
  }
}
