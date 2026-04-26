/**
 * 学习库上传确认 API
 * 
 * 前端上传完成后调用此 API，完成以下操作：
 * 1. 设置文件为永久公开读取
 * 2. 创建学习库记录
 * 3. 通知 Seed 2.0 有新数据（让它决定是否学习）
 * 
 * POST /api/learning-library/upload/confirm
 * 
 * 请求体：
 * {
 *   key: string;         // TOS key
 *   fileName: string;    // 文件名
 *   fileSize?: number;   // 文件大小
 *   publicUrl: string;   // 公开访问 URL
 * }
 * 
 * 返回：
 * {
 *   success: boolean;
 *   learning: { id, name, publicUrl, message };
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { VideoStorageService } from '@/lib/tos-storage';
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
    const { key, fileName, fileSize, publicUrl } = body;

    if (!key || !fileName) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 验证文件归属（支持 videos 和 learning-videos 路径）
    const expectedPrefix = `users/${decoded.userId}/`;
    if (!key.startsWith(expectedPrefix)) {
      return NextResponse.json({ error: '无权访问此文件' }, { status: 403 });
    }

    // 设置为永久公开读取
    console.log(`[学习库确认] 设置永久公开读取: ${key}`);
    await VideoStorageService.setPublicRead(key);

    // 创建学习库记录
    const client = getSupabaseClient();
    const { data: learning, error: insertError } = await client
      .from('learning_library')
      .insert({
        user_id: decoded.userId,
        video_name: fileName,
        video_key: key,
        video_url: publicUrl,
        video_size: fileSize || 0,
        analysis_status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      console.error('[学习库确认] 创建记录失败:', insertError);
      return NextResponse.json({ error: '创建学习记录失败' }, { status: 500 });
    }

    if (!learning) {
      return NextResponse.json({ error: '创建学习记录失败' }, { status: 500 });
    }

    const learningAny = learning as any;

    console.log(`[学习库确认] 记录创建成功: ${learningAny.id}`);

    // 注意：这里不激活 Seed 2.0 进行分析
    // 只通知有新的偏好数据，由 Seed 2.0 决定是否学习
    // 通知方式：在创意小海的对话中可以看到学习库有更新

    return NextResponse.json({
      success: true,
      learning: {
        id: learningAny.id,
        name: fileName,
        publicUrl: publicUrl,
        message: '视频已保存到学习库，Seed 2.0 可以随时学习',
      },
    });

  } catch (error) {
    console.error('[学习库确认] 错误:', error);
    
    if (error instanceof jwt.JsonWebTokenError) {
      return NextResponse.json({ error: '登录已过期' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '确认上传失败' },
      { status: 500 }
    );
  }
}
