import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { LearningLibraryStorage } from '@/lib/tos-storage';
import { videoLearningService } from '@/lib/video-learning-service';
import { HeaderUtils } from 'coze-coding-dev-sdk';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// 临时存储分块数据（生产环境应使用Redis或数据库）
const chunkStore = new Map<string, { chunks: Buffer[]; totalChunks: number; fileName: string; fileType: string; receivedChunks: number }>();

/**
 * 分块上传API
 * 
 * POST /api/learning-library/chunk
 * 
 * 请求体:
 * - chunkIndex: 当前分块索引
 * - totalChunks: 总分块数
 * - uploadId: 上传会话ID
 * - fileName: 文件名
 * - fileType: 文件类型
 * - chunk: 分块数据（FormData）
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

    const contentType = request.headers.get('content-type') || '';
    
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: '无效的请求格式' }, { status: 400 });
    }

    // 解析 FormData
    const formData = await request.formData();
    const chunkIndex = parseInt(formData.get('chunkIndex') as string);
    const totalChunks = parseInt(formData.get('totalChunks') as string);
    const uploadId = formData.get('uploadId') as string;
    const fileName = formData.get('fileName') as string;
    const fileType = formData.get('fileType') as string || 'video/mp4';
    const chunk = formData.get('chunk') as File;

    if (isNaN(chunkIndex) || isNaN(totalChunks) || !uploadId || !chunk) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    console.log(`[分块上传] 收到分块 ${chunkIndex + 1}/${totalChunks}, uploadId: ${uploadId}`);

    // 读取分块数据
    const chunkBuffer = Buffer.from(await chunk.arrayBuffer());

    // 获取或创建上传会话
    let session = chunkStore.get(uploadId);
    if (!session) {
      session = {
        chunks: new Array(totalChunks),
        totalChunks,
        fileName,
        fileType,
        receivedChunks: 0,
      };
      chunkStore.set(uploadId, session);
    }

    // 存储分块
    session.chunks[chunkIndex] = chunkBuffer;
    session.receivedChunks++;

    console.log(`[分块上传] 已接收 ${session.receivedChunks}/${totalChunks} 个分块`);

    // 如果所有分块都已接收，合并并上传
    if (session.receivedChunks === totalChunks) {
      console.log(`[分块上传] 所有分块已接收，开始合并上传`);

      // 合并所有分块
      const totalBuffer = Buffer.concat(session.chunks);
      const fileSize = totalBuffer.length;

      console.log(`[分块上传] 文件合并完成，大小: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

      // 上传到 TOS
      const fileKey = await LearningLibraryStorage.uploadLearningVideo(
        decoded.userId,
        totalBuffer,
        fileName,
        fileType
      );

      // 生成访问 URL
      const fileUrl = await LearningLibraryStorage.getLearningVideoUrl(fileKey, 24 * 60 * 60);

      // 创建学习记录
      const client = getSupabaseClient();
      const { data: learning, error: insertError } = await client
        .from('learning_library')
        .insert({
          user_id: decoded.userId,
          video_name: fileName,
          video_key: fileKey,
          video_url: fileUrl,
          video_size: fileSize,
          analysis_status: 'pending',
        })
        .select()
        .single();

      if (insertError) {
        console.error('[分块上传] 创建学习记录失败:', insertError);
        return NextResponse.json({ error: '创建学习记录失败' }, { status: 500 });
      }

      // 清理临时数据
      chunkStore.delete(uploadId);

      if (!learning) {
        return NextResponse.json({ error: '创建学习记录失败' }, { status: 500 });
      }

      const learningAny = learning as any;

      // 异步启动分析
      const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
      setTimeout(() => {
        startVideoAnalysis(learningAny.id as string, fileUrl, fileName, customHeaders);
      }, 1000);

      console.log(`[分块上传] 上传完成，学习记录ID: ${learningAny.id}`);

      return NextResponse.json({
        success: true,
        completed: true,
        learning: {
          id: learningAny.id,
          name: fileName,
          size: fileSize,
          status: 'pending',
          message: '视频已上传，正在分析中...',
        },
      });
    }

    // 返回进度
    return NextResponse.json({
      success: true,
      completed: false,
      receivedChunks: session.receivedChunks,
      totalChunks,
      progress: Math.round((session.receivedChunks / totalChunks) * 100),
    });

  } catch (error) {
    console.error('[分块上传] 错误:', error);
    
    if (error instanceof jwt.JsonWebTokenError) {
      return NextResponse.json({ error: '登录已过期' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '上传失败' },
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
    console.error('[分块上传] 视频分析失败:', error);
    
    await client
      .from('learning_library')
      .update({
        analysis_status: 'failed',
        analysis_error: error instanceof Error ? error.message : '分析失败',
      })
      .eq('id', learningId);
  }
}
