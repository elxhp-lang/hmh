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
import { videoLearningService } from '@/lib/video-learning-service';
import { HeaderUtils } from 'coze-coding-dev-sdk';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
interface LearningRow {
  id: string;
}
function isLearningRow(value: unknown): value is LearningRow {
  if (!value || typeof value !== 'object') return false;
  return typeof (value as Record<string, unknown>).id === 'string';
}

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
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);

    const body = await request.json();
    const { key, fileKey, fileName, fileSize, publicUrl } = body;
    const targetKey = (typeof key === 'string' && key) || (typeof fileKey === 'string' && fileKey) || '';

    if (!targetKey || !fileName) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 验证文件归属（兼容 legacy 路径）
    const expectedPrefixes = [
      `users/${decoded.userId}/learning-videos/`,
      `learning-library/${decoded.userId}/`,
    ];
    if (!expectedPrefixes.some((prefix) => targetKey.startsWith(prefix))) {
      return NextResponse.json({ error: '无权访问此文件' }, { status: 403 });
    }

    // 优先公开 URL，失败降级为入参 publicUrl
    console.log(`[学习库确认] 设置永久公开读取: ${targetKey}`);
    let finalPublicUrl = typeof publicUrl === 'string' ? publicUrl : '';
    try {
      const aclOk = await VideoStorageService.setPublicRead(targetKey);
      if (aclOk) {
        finalPublicUrl = VideoStorageService.getVideoPublicUrl(targetKey);
      }
    } catch {
      // keep fallback url
    }
    if (!finalPublicUrl) {
      return NextResponse.json({ error: '无法生成可访问的视频地址' }, { status: 400 });
    }

    // 创建学习库记录
    const client = getSupabaseClient();
    const { data: learning, error: insertError } = await client
      .from('learning_library')
      .insert({
        user_id: decoded.userId,
        video_name: fileName,
        video_key: targetKey,
        video_url: finalPublicUrl,
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
    if (!isLearningRow(learning)) {
      return NextResponse.json({ error: '学习记录数据异常' }, { status: 500 });
    }

    const learningRow = learning;

    console.log(`[学习库确认] 记录创建成功: ${learningRow.id}`);

    // 对齐 /confirm 逻辑：异步启动分析
    setTimeout(() => {
      startVideoAnalysis(learningRow.id, finalPublicUrl, fileName, customHeaders);
    }, 1000);

    return NextResponse.json({
      success: true,
      learning: {
        id: learningRow.id,
        name: fileName,
        publicUrl: finalPublicUrl,
        message: '视频已保存到学习库，正在分析中...',
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

async function startVideoAnalysis(
  learningId: string,
  videoUrl: string,
  videoName: string,
  headers: Record<string, string>
) {
  const client = getSupabaseClient();
  try {
    await client
      .from('learning_library')
      .update({ analysis_progress: 10 })
      .eq('id', learningId);

    const result = await videoLearningService.analyzeVideo(videoUrl, videoName, headers);

    await client
      .from('learning_library')
      .update({ analysis_progress: 80 })
      .eq('id', learningId);

    await videoLearningService.saveAnalysisResult(learningId, result);
  } catch (error) {
    console.error('[学习库确认] 视频分析失败:', error);
    await client
      .from('learning_library')
      .update({
        analysis_status: 'failed',
        analysis_error: error instanceof Error ? error.message : '分析失败',
      })
      .eq('id', learningId);
  }
}
