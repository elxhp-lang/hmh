import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { LearningLibraryStorage, VideoStorageService } from '@/lib/tos-storage';
import { videoLearningService } from '@/lib/video-learning-service';
import { HeaderUtils } from 'coze-coding-dev-sdk';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * 确认上传完成并创建学习记录
 * 
 * POST /api/learning-library/confirm
 * 
 * 请求体: { fileKey: string, fileName: string, fileSize: number }
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
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);

    const body = await request.json();
    const { fileKey, fileName, fileSize } = body;

    // 验证参数
    if (!fileKey || !fileName || !fileSize) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 验证文件归属（确保是用户自己的文件）
    const expectedPrefix = `learning-library/${decoded.userId}/`;
    if (!fileKey.startsWith(expectedPrefix)) {
      return NextResponse.json({ error: '无权访问此文件' }, { status: 403 });
    }

    // 创建学习记录
    const client = getSupabaseClient();
    const { data: learning, error: insertError } = await client
      .from('learning_library')
      .insert({
        user_id: decoded.userId,
        video_name: fileName,
        video_key: fileKey,
        video_url: '', // 先留空，后续更新
        video_size: fileSize,
        analysis_status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      console.error('创建学习记录失败:', insertError);
      return NextResponse.json({ error: '创建学习记录失败' }, { status: 500 });
    }

    // 设置文件为公开读取（用于视觉模型分析）
    console.log(`[学习库确认] 设置文件公开读取: ${fileKey}`);
    const publicUrl = await VideoStorageService.setPublicRead(fileKey)
      .then(async (success) => {
        if (success) {
          // 生成公开可访问的 URL
          return VideoStorageService.getVideoPublicUrl(fileKey);
        }
        // 如果设置公开读取失败，使用签名 URL
        return await LearningLibraryStorage.getLearningVideoUrl(fileKey, 24 * 60 * 60);
      })
      .catch(async (err) => {
        console.error('[学习库确认] 设置公开读取失败:', err);
        // 降级到签名 URL
        return await LearningLibraryStorage.getLearningVideoUrl(fileKey, 24 * 60 * 60);
      });

    if (!learning) {
      return NextResponse.json({ error: '未找到上传记录' }, { status: 400 });
    }

    const learningAny = learning as any;

    // 更新学习记录的 video_url
    await client
      .from('learning_library')
      .update({ video_url: publicUrl })
      .eq('id', learningAny.id as string);

    // 异步启动分析（使用公开 URL）
    setTimeout(() => {
      startVideoAnalysis(learningAny.id as string, publicUrl, fileName, customHeaders);
    }, 1000);

    return NextResponse.json({
      success: true,
      learning: {
        id: learningAny.id,
        name: fileName,
        size: fileSize,
        videoUrl: publicUrl,
        status: 'pending',
        message: '视频已上传，正在分析中...',
      },
    });
  } catch (error) {
    console.error('确认上传失败:', error);
    
    if (error instanceof jwt.JsonWebTokenError) {
      return NextResponse.json({ error: '登录已过期' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '确认上传失败' },
      { status: 500 }
    );
  }
}

/**
 * 异步执行视频分析
 */
async function startVideoAnalysis(
  learningId: string,
  videoUrl: string,
  videoName: string,
  headers: Record<string, string>
) {
  const client = getSupabaseClient();
  
  try {
    // 更新进度
    await client
      .from('learning_library')
      .update({ analysis_progress: 10 })
      .eq('id', learningId);

    // 执行分析
    const result = await videoLearningService.analyzeVideo(videoUrl, videoName, headers);

    // 更新进度
    await client
      .from('learning_library')
      .update({ analysis_progress: 80 })
      .eq('id', learningId);

    // 保存结果
    await videoLearningService.saveAnalysisResult(learningId, result);

    // 同时保存到长期记忆
    const { data: learningData } = await client
      .from('learning_library')
      .select('user_id')
      .eq('id', learningId)
      .single();

    if (learningData?.user_id) {
      await client
        .from('creative_memories')
        .insert({
          user_id: learningData.user_id,
          memory_type: 'video_reference',
          title: `视频学习: ${videoName}`,
          summary: result.summary,
          content: JSON.stringify({
            style: result.videoStyle,
            theme: result.videoTheme,
            sceneAnalysis: result.sceneAnalysis,
            cameraAnalysis: result.cameraAnalysis,
            keyLearnings: result.keyLearnings,
          }),
          source_type: 'learning_library',
          keywords: result.styleKeywords,
          importance_score: 0.7,
        });
    }

  } catch (error) {
    console.error('视频分析失败:', error);
    
    await client
      .from('learning_library')
      .update({
        analysis_status: 'failed',
        analysis_error: error instanceof Error ? error.message : '分析失败',
      })
      .eq('id', learningId);
  }
}
